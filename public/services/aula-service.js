/* ============================================================
   AulaService — Capa de datos para Aula (Plataforma Colaborativa)
   Firestore CRUD · Clases · Publicaciones · Entregas · Portfolio
   Optimizado: cache en memoria, queries con limit, paginacion
   ============================================================ */
(function (global) {
  const AulaService = (function () {

    // ── Colecciones ──
    const CLASES = 'aula-clases';
    const MIEMBROS = 'aula-miembros';
    const PUBS = 'aula-publicaciones';
    const ENTREGAS = 'aula-entregas';
    const COMMENTS = 'aula-comentarios';
    const VOTOS = 'aula-votos';
    const GRUPOS = 'aula-grupos';

    const fv = SIA.FieldValue;
    const CAREER_ALIASES = Object.freeze({
      ISC: ['INGENIERIA EN SISTEMAS COMPUTACIONALES', 'ING. EN SISTEMAS COMPUTACIONALES'],
      ARQ: ['ARQUITECTURA'],
      CP: ['CONTADOR PUBLICO'],
      GASTRO: ['GASTRONOMIA'],
      CIVIL: ['INGENIERIA CIVIL'],
      ELEC: ['INGENIERIA ELECTROMECANICA'],
      ADM: ['INGENIERIA EN ADMINISTRACION'],
      TUR: ['LICENCIATURA EN TURISMO', 'TURISMO']
    });

    // ── Cache en memoria con TTL ──
    const _cache = {};
    const CACHE_TTL = 60000; // 1 min

    /**
     * Obtiene datos del cache o ejecuta fn y cachea el resultado
     * @param {string} key - Clave unica del cache
     * @param {Function} fn - Funcion async que retorna datos
     * @param {number} [ttl] - TTL en ms (default 60s)
     * @returns {Promise<*>}
     */
    async function cached(key, fn, ttl) {
      const entry = _cache[key];
      if (entry && Date.now() - entry.ts < (ttl || CACHE_TTL)) return entry.data;
      const data = await fn();
      _cache[key] = { data, ts: Date.now() };
      return data;
    }

    /** Invalida cache por prefijo */
    function invalidateCache(prefix) {
      Object.keys(_cache).forEach(k => { if (k.startsWith(prefix)) delete _cache[k]; });
    }

    /** Limpia todo el cache */
    function clearCache() {
      Object.keys(_cache).forEach(k => delete _cache[k]);
    }

    function _getAulaAccessLevel(profile) {
      if (global.SIA?.getAulaAccessLevel) {
        return global.SIA.getAulaAccessLevel(profile);
      }
      const role = profile?.role || 'estudiante';
      if (['admin', 'aula_admin', 'aula', 'superadmin'].includes(role)) return 'admin';
      if (profile?.permissions?.aula === 'admin') return 'admin';
      if (profile?.permissions?.aula === 'docente' || role === 'docente') return 'docente';
      return null;
    }

    function _isAulaDocenteProfile(profile) {
      return Boolean(_getAulaAccessLevel(profile));
    }

    function _canManageClase(profile, clase, uid) {
      if (global.SIA?.canManageAulaClase) {
        return global.SIA.canManageAulaClase(profile, clase, uid);
      }
      return _getAulaAccessLevel(profile) === 'admin' || Boolean(clase && clase.docenteId === uid);
    }

    function _tsValue(value) {
      if (!value) return 0;
      if (typeof value.toMillis === 'function') return value.toMillis();
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function _entregaSortValue(entrega) {
      return _tsValue(entrega?.updatedAt) || _tsValue(entrega?.entregadoAt) || _tsValue(entrega?.createdAt);
    }

    function _pickLatestEntrega(current, candidate) {
      if (!current) return candidate;
      return _entregaSortValue(candidate) > _entregaSortValue(current) ? candidate : current;
    }

    function _normalizeCareerText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim();
    }

    function _getCareerTokens(value) {
      const normalized = _normalizeCareerText(value);
      if (!normalized) return [];

      const compact = normalized.replace(/\s+/g, '');
      const tokens = new Set([normalized, compact]);

      Object.entries(CAREER_ALIASES).forEach(([code, names]) => {
        const normalizedNames = names.map(_normalizeCareerText);
        if (code === normalized || code === compact || normalizedNames.includes(normalized)) {
          tokens.add(code);
          normalizedNames.forEach(name => {
            tokens.add(name);
            tokens.add(name.replace(/\s+/g, ''));
          });
        }
      });

      return [...tokens];
    }

    function _matchesCareer(candidate, expected) {
      const expectedTokens = new Set(_getCareerTokens(expected));
      if (!expectedTokens.size) return false;
      return _getCareerTokens(candidate).some(token => expectedTokens.has(token));
    }

    function _mergeEntregas(entregas) {
      const map = {};
      (entregas || []).forEach(entrega => {
        if (!entrega?.publicacionId) return;
        map[entrega.publicacionId] = _pickLatestEntrega(map[entrega.publicacionId], entrega);
      });
      return Object.values(map).sort((a, b) => _entregaSortValue(b) - _entregaSortValue(a));
    }

    async function _getMiembroDoc(ctx, claseId, uid) {
      const snap = await ctx.db.collection(MIEMBROS)
        .where('claseId', '==', claseId)
        .where('userId', '==', uid)
        .limit(1)
        .get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    async function _ensureClaseDocente(ctx, claseId) {
      const uid = ctx.auth.currentUser.uid;
      const clase = await getClase(ctx, claseId);
      if (!clase) throw new Error('CLASE_NO_ENCONTRADA');
      if (_canManageClase(ctx.profile || {}, clase, uid)) return clase;
      const miembro = await _getMiembroDoc(ctx, claseId, uid);
      if (miembro?.rol === 'docente') return clase;
      throw new Error('NO_AUTORIZADO');
    }

    async function _ensureClaseManager(ctx, claseId) {
      const uid = ctx.auth.currentUser.uid;
      const clase = await getClase(ctx, claseId);
      if (!clase) throw new Error('CLASE_NO_ENCONTRADA');
      if (_canManageClase(ctx.profile || {}, clase, uid)) return clase;
      throw new Error('NO_AUTORIZADO');
    }

    async function _deleteDocsInChunks(docs) {
      if (!Array.isArray(docs) || !docs.length) return;
      for (let i = 0; i < docs.length; i += 450) {
        const batch = SIA.db.batch();
        docs.slice(i, i + 450).forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
    }

    function _normalizeRubrica(rubrica) {
      if (!Array.isArray(rubrica) || !rubrica.length) return null;
      const normalized = rubrica.map(c => {
        const niveles = Array.isArray(c?.niveles) ? c.niveles.map(n => ({
          label: n?.label || '',
          pct: Number.isFinite(Number(n?.pct)) ? Number(n.pct) : 0,
          descripcion: n?.descripcion || ''
        })) : [];
        return {
          criterio: c?.criterio || '',
          peso: Number.isFinite(Number(c?.peso)) ? Number(c.peso) : 0,
          niveles
        };
      }).filter(c => c.criterio);
      return normalized.length ? normalized : null;
    }

    function _sanitizeFileName(name) {
      return String(name || 'archivo')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'archivo';
    }

    function _inferAttachmentName(url) {
      const raw = String(url || '').trim();
      if (!raw) return 'Archivo';
      try {
        const parsed = new URL(raw);
        const lastSegment = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '').trim();
        if (lastSegment) return lastSegment;
        return parsed.hostname || 'Archivo';
      } catch (_) {
        return 'Archivo';
      }
    }

    function _normalizeArchivos(archivos) {
      if (!Array.isArray(archivos) || !archivos.length) return [];
      return archivos.map(item => {
        const url = String(item?.url || '').trim();
        if (!url) return null;
        const rawNombre = String(item?.nombre || item?.titulo || '').trim();
        const hasBrokenEventLabel = /^\[object\s+[A-Za-z]+Event\]$/i.test(rawNombre);
        const nombre = !rawNombre || hasBrokenEventLabel ? _inferAttachmentName(url) : rawNombre;
        const rawTipo = String(item?.tipo || item?.tipoAdjunto || '').trim().toLowerCase();
        const tipo = rawTipo
          ? (rawTipo === 'url' ? 'url' : 'file')
          : ((item?.origen === 'upload' || item?.mime || item?.mimeType) ? 'file' : 'url');
        const mime = String(item?.mime || item?.mimeType || '').trim();
        const subtitulo = String(item?.subtitulo || item?.subtitle || '').trim();
        const size = Number(item?.size);
        return {
          nombre,
          url,
          tipo,
          mime,
          subtitulo,
          size: Number.isFinite(size) && size > 0 ? size : null
        };
      }).filter(Boolean).slice(0, 10);
    }

    async function _hydrateEntregas(ctx, entregas) {
      const pubIds = [...new Set((entregas || []).map(e => e.publicacionId).filter(Boolean))];
      if (!pubIds.length) return entregas || [];

      const batches = [];
      for (let i = 0; i < pubIds.length; i += 10) {
        const batch = pubIds.slice(i, i + 10);
        batches.push(ctx.db.collection(PUBS).where(SIA.FieldPath.documentId(), 'in', batch).get());
      }

      const snaps = await Promise.all(batches);
      const pubMap = {};
      snaps.forEach(snap => {
        snap.docs.forEach(doc => {
          pubMap[doc.id] = { id: doc.id, ...doc.data() };
        });
      });

      return (entregas || []).map(entrega => {
        const pub = pubMap[entrega.publicacionId] || {};
        return {
          ...entrega,
          publicacionTitulo: entrega.publicacionTitulo || pub.titulo || 'Entrega',
          puntajeMax: entrega.puntajeMax || pub.puntajeMax || 100,
          grupoNombre: entrega.grupoNombre || pub.grupoNombre || null,
          isGroupDelivery: Boolean(entrega.grupoId || pub.grupoId)
        };
      }).sort((a, b) => _entregaSortValue(b) - _entregaSortValue(a));
    }

    // ══════════════════════════════════════════════════════════
    //  CLASES
    // ══════════════════════════════════════════════════════════

    /**
     * Genera un codigo de acceso unico de 6 caracteres
     * @param {object} ctx - Contexto SIA
     * @returns {Promise<string>}
     */
    async function generateJoinCode(ctx) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let attempts = 0;
      while (attempts < 10) {
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        const exists = await ctx.db.collection(CLASES).where('codigoAcceso', '==', code).limit(1).get();
        if (exists.empty) return code;
        attempts++;
      }
      throw new Error('No se pudo generar codigo unico');
    }

    /**
     * Crea una nueva clase
     * @param {object} ctx - Contexto SIA
     * @param {object} data - { titulo, descripcion, materia, carrera, semestre, color, icono, carreraNombre, carreraId, semestreNumero, semestreLabel, turno, turnoId, materiaId }
     * @returns {Promise<DocumentReference>}
     */
    async function createClase(ctx, data) {
      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};
      if (!_isAulaDocenteProfile(profile)) throw new Error('NO_AUTORIZADO');
      const code = await generateJoinCode(ctx);
      const now = fv.serverTimestamp();
      const ref = await ctx.db.collection(CLASES).add({
        titulo: data.titulo || '',
        tituloPersonalizado: Boolean(data.tituloPersonalizado),
        descripcion: data.descripcion || '',
        materia: data.materia || '',
        materiaOriginal: data.materiaOriginal || '',
        materiaManual: Boolean(data.materiaManual),
        materiaPersonalizada: Boolean(data.materiaPersonalizada),
        carrera: data.carrera || '',
        carreraNombre: data.carreraNombre || data.carrera || '',
        carreraId: data.carreraId || '',
        semestre: data.semestre || '',
        semestreLabel: data.semestreLabel || data.semestre || '',
        semestreNumero: Number.isFinite(Number(data.semestreNumero)) ? Number(data.semestreNumero) : null,
        turno: data.turno || '',
        turnoId: data.turnoId || '',
        materiaId: data.materiaId || '',
        catalogVersion: data.catalogVersion || '',
        color: data.color || '#6366f1',
        icono: data.icono || 'bi-book',
        codigoAcceso: code,
        docenteId: user.uid,
        docenteNombre: profile.displayName || user.displayName || user.email,
        docenteEmail: user.email,
        miembrosCount: 1,
        archivada: false,
        createdAt: now,
        updatedAt: now
      });
      // Auto-agregar al docente como miembro
      await ctx.db.collection(MIEMBROS).add({
        claseId: ref.id,
        userId: user.uid,
        userName: profile.displayName || user.displayName || user.email,
        userEmail: user.email,
        matricula: '',
        carrera: '',
        rol: 'docente',
        joinedAt: now
      });
      invalidateCache('clases_');
      return ref;
    }

    /**
     * Obtiene una clase por ID (con cache 30s)
     * @param {object} ctx
     * @param {string} claseId
     * @returns {Promise<object|null>}
     */
    async function getClase(ctx, claseId) {
      return cached(`clase_${claseId}`, async () => {
        const s = await ctx.db.collection(CLASES).doc(claseId).get();
        return s.exists ? { id: s.id, ...s.data() } : null;
      }, 30000);
    }

    /**
     * Actualiza una clase
     * @param {object} ctx
     * @param {string} claseId
     * @param {object} data
     */
    async function updateClase(ctx, claseId, data) {
      await _ensureClaseManager(ctx, claseId);
      await ctx.db.collection(CLASES).doc(claseId).update({ ...data, updatedAt: fv.serverTimestamp() });
      invalidateCache('clase_' + claseId);
      invalidateCache('clases_');
    }

    /**
     * Archiva/desarchiva una clase
     * @param {object} ctx
     * @param {string} claseId
     * @param {boolean} archivar
     */
    async function archivarClase(ctx, claseId, archivar) {
      await _ensureClaseManager(ctx, claseId);
      await ctx.db.collection(CLASES).doc(claseId).update({
        archivada: archivar,
        updatedAt: fv.serverTimestamp()
      });
      invalidateCache('clases_');
      invalidateCache('clase_' + claseId);
    }

    /**
     * Elimina una clase y sus colecciones relacionadas.
     * @param {object} ctx
     * @param {string} claseId
     */
    async function deleteClase(ctx, claseId) {
      await _ensureClaseManager(ctx, claseId);

      const pubsSnap = await ctx.db.collection(PUBS).where('claseId', '==', claseId).get();
      const pubIds = pubsSnap.docs.map(doc => doc.id);

      const commentDocs = [];
      for (let i = 0; i < pubIds.length; i += 10) {
        const batchIds = pubIds.slice(i, i + 10);
        if (!batchIds.length) continue;
        const [commentsSnap, votosSnap] = await Promise.all([
          ctx.db.collection(COMMENTS).where('publicacionId', 'in', batchIds).get(),
          ctx.db.collection(VOTOS).where('publicacionId', 'in', batchIds).get()
        ]);
        commentDocs.push(...commentsSnap.docs);
        await _deleteDocsInChunks(votosSnap.docs);
      }

      const commentIds = commentDocs.map(doc => doc.id);
      for (let i = 0; i < commentIds.length; i += 10) {
        const batchIds = commentIds.slice(i, i + 10);
        if (!batchIds.length) continue;
        const reaccionesSnap = await ctx.db.collection(REACCIONES).where('comentarioId', 'in', batchIds).get();
        await _deleteDocsInChunks(reaccionesSnap.docs);
      }

      const [miembrosSnap, entregasSnap, gruposSnap] = await Promise.all([
        ctx.db.collection(MIEMBROS).where('claseId', '==', claseId).get(),
        ctx.db.collection(ENTREGAS).where('claseId', '==', claseId).get(),
        ctx.db.collection(GRUPOS).where('claseId', '==', claseId).get()
      ]);

      await _deleteDocsInChunks(commentDocs);
      await _deleteDocsInChunks(entregasSnap.docs);
      await _deleteDocsInChunks(gruposSnap.docs);
      await _deleteDocsInChunks(miembrosSnap.docs);
      await _deleteDocsInChunks(pubsSnap.docs);
      await ctx.db.collection(CLASES).doc(claseId).delete();

      invalidateCache('clases_');
      invalidateCache('clase_' + claseId);
      invalidateCache('miembros_');
      invalidateCache('pubs_');
      invalidateCache('entregas_');
      invalidateCache('entregas_pub_');
      invalidateCache('entregas_est_');
      invalidateCache('grupos_');
      invalidateCache('grupo_');
      invalidateCache('rol_');
      invalidateCache('tabla_cal_');
      invalidateCache('comunidad_recientes_');
    }

    /**
     * Busca una clase por codigo de acceso
     * @param {object} ctx
     * @param {string} code
     * @returns {Promise<object|null>}
     */
    async function getClaseByCode(ctx, code) {
      const snap = await ctx.db.collection(CLASES)
        .where('codigoAcceso', '==', code.toUpperCase().trim())
        .limit(1).get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    /**
     * Obtiene las clases del usuario (como miembro). Optimizado con batches de 10.
     * @param {object} ctx
     * @param {string} uid
     * @param {number} [limit_] - Limite de clases (default 30)
     * @returns {Promise<Array>}
     */
    async function getMisClases(ctx, uid, limit_, options) {
      const lim = limit_ || 30;
      const includeArchived = options?.includeArchived === true;
      return cached(`clases_${uid}_${lim}_${includeArchived ? 'all' : 'active'}`, async () => {
        const miembrosSnap = await ctx.db.collection(MIEMBROS)
          .where('userId', '==', uid)
          .limit(lim)
          .get();
        if (miembrosSnap.empty) return [];
        const claseIds = miembrosSnap.docs.map(d => d.data().claseId);
        const batches = [];
        for (let i = 0; i < claseIds.length; i += 10) {
          const batch = claseIds.slice(i, i + 10);
          batches.push(ctx.db.collection(CLASES).where(SIA.FieldPath.documentId(), 'in', batch).get());
        }
        const results = await Promise.all(batches);
        const clases = [];
        results.forEach(snap => {
          snap.docs.forEach(d => {
            const data = d.data();
            if (!data.archivada || includeArchived) clases.push({ id: d.id, ...data });
          });
        });
        clases.sort((a, b) => {
          if (Boolean(a.archivada) !== Boolean(b.archivada)) {
            return a.archivada ? 1 : -1;
          }
          const ta = _tsValue(a.updatedAt) || _tsValue(a.createdAt);
          const tb = _tsValue(b.updatedAt) || _tsValue(b.createdAt);
          return tb - ta;
        });
        return clases;
      }, 15000);
    }

    // ══════════════════════════════════════════════════════════
    //  MIEMBROS
    // ══════════════════════════════════════════════════════════

    /**
     * Unirse a una clase por codigo
     * @param {object} ctx
     * @param {string} code - Codigo de acceso
     * @returns {Promise<object>} - La clase a la que se unio
     */
    async function joinClase(ctx, code) {
      const clase = await getClaseByCode(ctx, code);
      if (!clase) throw new Error('CLASE_NO_ENCONTRADA');
      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};

      const exists = await ctx.db.collection(MIEMBROS)
        .where('claseId', '==', clase.id)
        .where('userId', '==', user.uid)
        .limit(1).get();
      if (!exists.empty) throw new Error('YA_ES_MIEMBRO');

      await ctx.db.collection(MIEMBROS).add({
        claseId: clase.id,
        userId: user.uid,
        userName: profile.displayName || user.displayName || user.email,
        userEmail: user.email,
        matricula: profile.matricula || '',
        carrera: profile.carrera || '',
        rol: 'estudiante',
        joinedAt: fv.serverTimestamp()
      });

      // Non-critical: update member count (wrapped to avoid failing the join if rules don't allow it yet)
      try {
        await ctx.db.collection(CLASES).doc(clase.id).update({ miembrosCount: fv.increment(1) });
      } catch (e) {
        console.warn('[AulaService] miembrosCount update skipped:', e.code);
      }

      invalidateCache('clases_');
      invalidateCache('miembros_');
      invalidateCache('rol_');
      invalidateCache('tabla_cal_');
      invalidateCache('comunidad_recientes_');
      return clase;
    }

    /**
     * Unirse a una clase por código como co-docente.
     * Si el usuario ya era estudiante de la clase, promueve su membresía a docente.
     * @param {object} ctx
     * @param {string} code
     * @returns {Promise<object>}
     */
    async function joinClaseAsDocente(ctx, code) {
      const clase = await getClaseByCode(ctx, code);
      if (!clase) throw new Error('CLASE_NO_ENCONTRADA');
      if (!_isAulaDocenteProfile(ctx.profile || {})) throw new Error('NO_ES_DOCENTE');

      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};
      const existing = await _getMiembroDoc(ctx, clase.id, user.uid);

      if (existing?.rol === 'docente') throw new Error('YA_ES_MIEMBRO');

      if (existing) {
        await ctx.db.collection(MIEMBROS).doc(existing.id).update({
          rol: 'docente',
          userName: profile.displayName || user.displayName || user.email,
          userEmail: user.email,
          matricula: profile.matricula || existing.matricula || '',
          carrera: profile.carrera || existing.carrera || ''
        });
      } else {
        await ctx.db.collection(MIEMBROS).add({
          claseId: clase.id,
          userId: user.uid,
          userName: profile.displayName || user.displayName || user.email,
          userEmail: user.email,
          matricula: profile.matricula || '',
          carrera: profile.carrera || '',
          rol: 'docente',
          joinedAt: fv.serverTimestamp()
        });

        try {
          await ctx.db.collection(CLASES).doc(clase.id).update({ miembrosCount: fv.increment(1) });
        } catch (e) {
          console.warn('[AulaService] miembrosCount update skipped:', e.code);
        }
      }

      invalidateCache('clases_');
      invalidateCache('miembros_');
      invalidateCache('rol_');
      invalidateCache('tabla_cal_');
      return clase;
    }

    /**
     * Agregar miembro manualmente por matricula
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} matricula
     */
    async function addMiembroByMatricula(ctx, claseId, matricula) {
      await _ensureClaseDocente(ctx, claseId);
      const userSnap = await ctx.db.collection('usuarios')
        .where('matricula', '==', matricula.trim())
        .limit(1).get();
      if (userSnap.empty) throw new Error('USUARIO_NO_ENCONTRADO');

      const userData = userSnap.docs[0].data();
      const userId = userSnap.docs[0].id;

      const exists = await ctx.db.collection(MIEMBROS)
        .where('claseId', '==', claseId)
        .where('userId', '==', userId)
        .limit(1).get();
      if (!exists.empty) throw new Error('YA_ES_MIEMBRO');

      await ctx.db.collection(MIEMBROS).add({
        claseId,
        userId,
        userName: userData.displayName || userData.email,
        userEmail: userData.email,
        matricula: userData.matricula || matricula,
        carrera: userData.carrera || '',
        rol: 'estudiante',
        joinedAt: fv.serverTimestamp()
      });

      await ctx.db.collection(CLASES).doc(claseId).update({
        miembrosCount: fv.increment(1)
      });
      invalidateCache('miembros_');
      invalidateCache('clases_');
      invalidateCache('rol_');
      invalidateCache('tabla_cal_');
    }

    /**
     * Agrega un co-docente a una clase por matrícula o email.
     * Solo puede llamarlo el owner (docenteId === currentUser.uid).
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} identificador - Matrícula o email del docente a agregar
     * @returns {Promise<void>}
     * @throws {'USUARIO_NO_ENCONTRADO'|'YA_ES_MIEMBRO'|'NO_ES_DOCENTE'}
     */
    async function addCoDocente(ctx, claseId, identificador) {
      await _ensureClaseManager(ctx, claseId);
      const id = identificador.trim();
      // Buscar por matrícula o email
      let userSnap = await ctx.db.collection('usuarios').where('matricula', '==', id).limit(1).get();
      if (userSnap.empty) {
        userSnap = await ctx.db.collection('usuarios').where('email', '==', id).limit(1).get();
      }
      if (userSnap.empty) throw new Error('USUARIO_NO_ENCONTRADO');

      const userData = userSnap.docs[0].data();
      const userId   = userSnap.docs[0].id;

      // Verificar que el usuario tenga rol de docente
      if (!_isAulaDocenteProfile(userData)) {
        throw new Error('NO_ES_DOCENTE');
      }

      // Verificar que no sea ya miembro
      const exists = await ctx.db.collection(MIEMBROS)
        .where('claseId', '==', claseId)
        .where('userId', '==', userId)
        .limit(1).get();
      if (!exists.empty) throw new Error('YA_ES_MIEMBRO');

      await ctx.db.collection(MIEMBROS).add({
        claseId,
        userId,
        userName:  userData.displayName || userData.email,
        userEmail: userData.email,
        matricula: userData.matricula || '',
        carrera:   userData.carrera   || '',
        rol:       'docente',
        joinedAt:  fv.serverTimestamp()
      });

      await ctx.db.collection(CLASES).doc(claseId).update({
        miembrosCount: fv.increment(1)
      });
      invalidateCache('miembros_');
      invalidateCache('clases_');
      invalidateCache('rol_');
      invalidateCache('tabla_cal_');
    }

    /**
     * Eliminar miembro de una clase
     * @param {object} ctx
     * @param {string} miembroDocId
     * @param {string} claseId
     */
    async function removeMiembro(ctx, miembroDocId, claseId) {
      const [clase, targetSnap] = await Promise.all([
        getClase(ctx, claseId),
        ctx.db.collection(MIEMBROS).doc(miembroDocId).get()
      ]);
      if (!clase) throw new Error('CLASE_NO_ENCONTRADA');
      if (!targetSnap.exists) throw new Error('MIEMBRO_NO_ENCONTRADO');

      const target = targetSnap.data() || {};
      const canManage = _canManageClase(ctx.profile || {}, clase, ctx.auth.currentUser.uid);
      const actor = await _getMiembroDoc(ctx, claseId, ctx.auth.currentUser.uid);
      const isDocenteEnClase = canManage || actor?.rol === 'docente' || clase.docenteId === ctx.auth.currentUser.uid;

      if (target.rol === 'docente' && !canManage) throw new Error('NO_AUTORIZADO');
      if (target.rol !== 'docente' && !isDocenteEnClase && target.userId !== ctx.auth.currentUser.uid) throw new Error('NO_AUTORIZADO');

      await ctx.db.collection(MIEMBROS).doc(miembroDocId).delete();
      await ctx.db.collection(CLASES).doc(claseId).update({
        miembrosCount: fv.increment(-1)
      });
      invalidateCache('miembros_');
      invalidateCache('clases_');
      invalidateCache('rol_');
      invalidateCache('tabla_cal_');
    }

    /**
     * Obtiene los miembros de una clase (con cache 30s, limite 100)
     * @param {object} ctx
     * @param {string} claseId
     * @param {number} [limit_] - Default 100
     * @returns {Promise<Array>}
     */
    async function getMiembros(ctx, claseId, limit_) {
      return cached(`miembros_${claseId}`, async () => {
        const snap = await ctx.db.collection(MIEMBROS)
          .where('claseId', '==', claseId)
          .limit(limit_ || 100)
          .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }, 30000);
    }

    /**
     * Obtiene el conteo de entregas pendientes de calificar para una clase
     * @param {object} ctx
     * @param {string} claseId
     * @param {number} [limit_] - Default 99
     * @returns {Promise<number>} Número de entregas pendientes
     */
    async function getEntregasPendientesByClase(ctx, claseId, limit_) {
      let ref = ctx.db.collection(ENTREGAS)
        .where('claseId', '==', claseId)
        .where('estado', 'in', ['entregado', 'tarde']);
      if (limit_) ref = ref.limit(limit_);
      const snap = await ref.get();
      return snap.size;
    }

    /**
     * Stream real-time de membresias del usuario (para detectar cambios en sus clases)
     * @param {object} ctx
     * @param {string} uid
     * @param {Function} cb - Callback de onSnapshot
     * @returns {Function} unsubscribe
     */
    function streamMisClasesMembres(ctx, uid, cb) {
      return ctx.db.collection(MIEMBROS)
        .where('userId', '==', uid)
        .onSnapshot(cb);
    }

    /**
     * Verifica si un usuario es miembro
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} uid
     * @returns {Promise<boolean>}
     */
    async function isMiembro(ctx, claseId, uid) {
      const snap = await ctx.db.collection(MIEMBROS)
        .where('claseId', '==', claseId)
        .where('userId', '==', uid)
        .limit(1).get();
      return !snap.empty;
    }

    /**
     * Obtiene el rol del usuario en una clase (con cache)
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} uid
     * @returns {Promise<string|null>} 'docente'|'estudiante'|null
     */
    async function getRolEnClase(ctx, claseId, uid) {
      return cached(`rol_${claseId}_${uid}`, async () => {
        const [clase, miembro] = await Promise.all([
          getClase(ctx, claseId),
          _getMiembroDoc(ctx, claseId, uid)
        ]);

        if (!clase) return null;
        if (clase.docenteId === uid) return 'docente';
        if (!miembro) return null;
        return miembro.rol === 'docente' ? 'docente' : (miembro.rol || 'estudiante');
      }, 30000);
    }

    /**
     * Obtiene una publicacion solo si pertenece a la clase indicada y el usuario puede verla.
     * Para estudiantes, valida membresia y grupo cuando aplique.
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} pubId
     * @param {string} [uid]
     * @returns {Promise<object|null>}
     */
    async function getPublicacionForClase(ctx, claseId, pubId, uid) {
      const pub = await getPublicacion(ctx, pubId);
      if (!pub || pub.claseId !== claseId) return null;
      if (!uid) return pub;

      const rol = await getRolEnClase(ctx, claseId, uid);
      if (!rol) return null;
      if (rol === 'docente') return pub;

      if (pub.grupoId) {
        const miGrupo = await getMiGrupo(ctx, claseId, uid);
        if (!miGrupo || miGrupo.id !== pub.grupoId) return null;
      }

      return pub;
    }

    // ══════════════════════════════════════════════════════════
    //  PUBLICACIONES
    // ══════════════════════════════════════════════════════════

    /**
     * Crea una publicacion en una clase
     * @param {object} ctx
     * @param {object} data - { claseId, tipo, titulo, contenido, archivos, ... }
     * @returns {Promise<DocumentReference>}
     */
    async function createPublicacion(ctx, data) {
      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};
      await _ensureClaseDocente(ctx, data.claseId);
      const now = fv.serverTimestamp();
      const rubrica = _normalizeRubrica(data.rubrica);
      const payload = {
        claseId: data.claseId,
        tipo: data.tipo || 'aviso',
        titulo: data.titulo || '',
        contenido: data.contenido || '',
        archivos: _normalizeArchivos(data.archivos),
        autorId: user.uid,
        autorNombre: profile.displayName || user.displayName || user.email,
        fijada: false,
        createdAt: now,
        updatedAt: now
      };
      if (data.tipo === 'tarea') {
        payload.fechaEntrega = data.fechaEntrega || null;
        payload.puntajeMax = data.puntajeMax || 100;
        payload.permiteEntregaTardia = data.permiteEntregaTardia || false;
        payload.visibleCarrera = data.visibleCarrera || false;
        payload.rubrica = rubrica;
        payload.grupoId = null;
        payload.grupoNombre = null;
        if (data.grupoId) {
          const grupo = await getGrupo(ctx, data.grupoId);
          if (!grupo || grupo.claseId !== data.claseId) throw new Error('GRUPO_INVALIDO');
          payload.grupoId = grupo.id;
          payload.grupoNombre = data.grupoNombre || grupo.nombre || 'Grupo';
        }
        if (data.visibleCarrera) {
          const clase = await getClase(ctx, data.claseId);
          payload.carrera = String(clase?.carrera || '').trim().toUpperCase();
          payload.carreraNombre = String(clase?.carreraNombre || '').trim();
        }
      }
      if (data.tipo === 'encuesta') {
        payload.opciones = Array.isArray(data.opciones) ? data.opciones : [];
        payload.resultadosVisibles = data.resultadosVisibles !== false;
      }
      if (data.tipo === 'discusion') {
        payload.cerrada = false;
      }
      const ref = await ctx.db.collection(PUBS).add(payload);
      invalidateCache('pubs_');
      invalidateCache('comunidad_recientes_');
      if (data.tipo === 'tarea') invalidateCache('community_');
      return ref;
    }

    /**
     * Actualiza una publicacion
     * @param {object} ctx
     * @param {string} pubId
     * @param {object} data
     */
    async function updatePublicacion(ctx, pubId, data) {
      const current = await getPublicacion(ctx, pubId);
      if (!current) throw new Error('PUBLICACION_NO_ENCONTRADA');
      await _ensureClaseDocente(ctx, current.claseId || data.claseId);
      const payload = { ...data, updatedAt: fv.serverTimestamp() };
      if (Object.prototype.hasOwnProperty.call(data, 'archivos')) {
        payload.archivos = _normalizeArchivos(data.archivos);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'rubrica')) {
        payload.rubrica = _normalizeRubrica(data.rubrica);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'grupoId')) {
        const pub = current;
        const claseId = data.claseId || pub?.claseId;
        if (data.grupoId) {
          const grupo = await getGrupo(ctx, data.grupoId);
          if (!grupo || grupo.claseId !== claseId) throw new Error('GRUPO_INVALIDO');
          payload.grupoId = grupo.id;
          payload.grupoNombre = data.grupoNombre || grupo.nombre || 'Grupo';
        } else {
          payload.grupoId = null;
          payload.grupoNombre = null;
        }
      }
      if ((current.tipo === 'tarea' || data.tipo === 'tarea') && Object.prototype.hasOwnProperty.call(data, 'visibleCarrera')) {
        payload.visibleCarrera = Boolean(data.visibleCarrera);
        if (payload.visibleCarrera) {
          const clase = await getClase(ctx, data.claseId || current.claseId);
          payload.carrera = String(clase?.carrera || current.carrera || '').trim().toUpperCase();
          payload.carreraNombre = String(clase?.carreraNombre || current.carreraNombre || '').trim();
        } else {
          payload.carrera = '';
          payload.carreraNombre = '';
        }
      }
      await ctx.db.collection(PUBS).doc(pubId).update(payload);
      invalidateCache('pubs_');
      invalidateCache('comunidad_recientes_');
      if (current.tipo === 'tarea' || data.tipo === 'tarea') invalidateCache('community_');
    }

    /**
     * Elimina una publicacion
     * @param {object} ctx
     * @param {string} pubId
     */
    async function deletePublicacion(ctx, pubId) {
      const pub = await getPublicacion(ctx, pubId);
      if (!pub) throw new Error('PUBLICACION_NO_ENCONTRADA');
      await _ensureClaseDocente(ctx, pub.claseId);

      const [entregasSnap, comentariosSnap, votosSnap] = await Promise.all([
        ctx.db.collection(ENTREGAS).where('publicacionId', '==', pubId).get(),
        ctx.db.collection(COMMENTS).where('publicacionId', '==', pubId).get(),
        ctx.db.collection(VOTOS).where('publicacionId', '==', pubId).get()
      ]);

      const comentarioIds = comentariosSnap.docs.map(doc => doc.id);
      for (let i = 0; i < comentarioIds.length; i += 10) {
        const batchIds = comentarioIds.slice(i, i + 10);
        if (!batchIds.length) continue;
        const reaccionesSnap = await ctx.db.collection(REACCIONES).where('comentarioId', 'in', batchIds).get();
        await _deleteDocsInChunks(reaccionesSnap.docs);
      }

      await _deleteDocsInChunks(entregasSnap.docs);
      await _deleteDocsInChunks(comentariosSnap.docs);
      await _deleteDocsInChunks(votosSnap.docs);
      await ctx.db.collection(PUBS).doc(pubId).delete();
      invalidateCache('pubs_');
      invalidateCache('entregas_');
      invalidateCache('entregas_pub_');
      invalidateCache('entregas_est_');
      invalidateCache('tabla_cal_');
      invalidateCache('comunidad_recientes_');
      if (pub.tipo === 'tarea') {
        invalidateCache('community_');
        invalidateCache('community_entregas_');
      }
    }

    /**
     * Stream real-time de publicaciones (limite 50)
     * @param {object} ctx
     * @param {string} claseId
     * @param {Function} cb
     * @param {object} [opciones] - { limit }
     * @returns {Function} unsubscribe
     */
    function streamPublicaciones(ctx, claseId, cb, opciones) {
      const opts = opciones || {};
      return ctx.db.collection(PUBS)
        .where('claseId', '==', claseId)
        .orderBy('createdAt', 'desc')
        .limit(opts.limit || 50)
        .onSnapshot(cb);
    }

    /**
     * Obtiene publicaciones con filtro y paginacion
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} [tipo]
     * @param {number} [limit_] - Default 30
     * @param {*} [startAfterDoc] - Cursor de paginacion
     * @returns {Promise<Array>}
     */
    async function getPublicaciones(ctx, claseId, tipo, limit_, startAfterDoc) {
      let ref = ctx.db.collection(PUBS).where('claseId', '==', claseId);
      if (tipo) ref = ref.where('tipo', '==', tipo);
      ref = ref.orderBy('createdAt', 'desc').limit(limit_ || 30);
      if (startAfterDoc) ref = ref.startAfter(startAfterDoc);
      const snap = await ref.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data(), _doc: d }));
    }

    /**
     * Obtiene una publicacion por ID
     * @param {object} ctx
     * @param {string} pubId
     * @returns {Promise<object|null>}
     */
    async function getPublicacion(ctx, pubId) {
      const s = await ctx.db.collection(PUBS).doc(pubId).get();
      return s.exists ? { id: s.id, ...s.data() } : null;
    }

    /**
     * Fija/desfija una publicacion
     * @param {object} ctx
     * @param {string} pubId
     * @param {boolean} fijar
     */
    async function toggleFijada(ctx, pubId, fijar) {
      const pub = await getPublicacion(ctx, pubId);
      if (!pub) throw new Error('PUBLICACION_NO_ENCONTRADA');
      await _ensureClaseDocente(ctx, pub.claseId);
      await ctx.db.collection(PUBS).doc(pubId).update({ fijada: fijar });
      invalidateCache('pubs_');
    }

    // ══════════════════════════════════════════════════════════
    //  ENTREGAS
    // ══════════════════════════════════════════════════════════

    /**
     * Envia una entrega de tarea
     * @param {object} ctx
     * @param {object} data - { publicacionId, claseId, contenido, archivos, fechaEntrega }
     * @returns {Promise<DocumentReference>}
     */
    async function submitEntrega(ctx, data) {
      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};
      const pub = await getPublicacion(ctx, data.publicacionId);
      if (!pub) throw new Error('PUBLICACION_NO_ENCONTRADA');
      const rol = await getRolEnClase(ctx, pub.claseId, user.uid);
      if (!rol) throw new Error('NO_AUTORIZADO');
      if (data.claseId && pub.claseId && data.claseId !== pub.claseId) {
        throw new Error('PUBLICACION_CLASE_INVALIDA');
      }

      let grupo = null;
      if (pub.grupoId) {
        grupo = await getMiGrupo(ctx, pub.claseId, user.uid);
        if (!grupo || grupo.id !== pub.grupoId) throw new Error('GRUPO_NO_AUTORIZADO');
        const existsGrupo = await ctx.db.collection(ENTREGAS)
          .where('publicacionId', '==', data.publicacionId)
          .where('grupoId', '==', grupo.id)
          .limit(1).get();
        if (!existsGrupo.empty) throw new Error('YA_ENTREGADO');
      } else {
        const exists = await ctx.db.collection(ENTREGAS)
          .where('publicacionId', '==', data.publicacionId)
          .where('estudianteId', '==', user.uid)
          .limit(1).get();
        if (!exists.empty) throw new Error('YA_ENTREGADO');
      }

      let estado = 'entregado';
      const limit = pub.fechaEntrega?.toDate ? pub.fechaEntrega.toDate() : (pub.fechaEntrega ? new Date(pub.fechaEntrega) : null);
      if (limit && new Date() > limit) {
        if (!pub.permiteEntregaTardia) throw new Error('FUERA_DE_TIEMPO');
        estado = 'tarde';
      }

      const entregaId = [
        data.publicacionId,
        grupo?.id ? `grupo_${grupo.id}` : user.uid
      ].join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
      const ref = ctx.db.collection(ENTREGAS).doc(entregaId);
      const payload = {
        publicacionId: data.publicacionId,
        claseId: pub.claseId,
        estudianteId: user.uid,
        estudianteNombre: profile.displayName || user.displayName || user.email,
        matricula: profile.matricula || '',
        grupoId: grupo?.id || null,
        grupoNombre: data.grupoNombre || grupo?.nombre || null,
        grupoMiembroIds: Array.isArray(grupo?.miembroIds) ? grupo.miembroIds : [],
        entregadoPorId: user.uid,
        entregadoPorNombre: profile.displayName || user.displayName || user.email,
        contenido: data.contenido || '',
        archivos: Array.isArray(data.archivos) ? data.archivos : [],
        calificacion: null,
        retroalimentacion: '',
        calificadoPor: null,
        calificadoAt: null,
        estado,
        entregadoAt: fv.serverTimestamp(),
        updatedAt: fv.serverTimestamp()
      };

      await ctx.db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) throw new Error('YA_ENTREGADO');
        transaction.set(ref, payload);
      });
      invalidateCache('entregas_');
      invalidateCache('entregas_pub_');
      invalidateCache('entregas_est_');
      invalidateCache('tabla_cal_');
      invalidateCache('community_entregas_');
      return ref;
    }

    /**
     * Actualiza una entrega (re-entregar)
     * @param {object} ctx
     * @param {string} entregaId
     * @param {object} data - { contenido, archivos }
     */
    async function updateEntrega(ctx, entregaId, data) {
      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};
      const entregaSnap = await ctx.db.collection(ENTREGAS).doc(entregaId).get();
      if (!entregaSnap.exists) throw new Error('ENTREGA_NO_ENCONTRADA');

      const entrega = { id: entregaSnap.id, ...entregaSnap.data() };
      if (entrega.calificacion != null || entrega.estado === 'calificado') throw new Error('ENTREGA_CALIFICADA');

      const pub = await getPublicacion(ctx, entrega.publicacionId);
      if (!pub) throw new Error('PUBLICACION_NO_ENCONTRADA');

      const puedeEditarGrupo = Boolean(entrega.grupoId) && Array.isArray(entrega.grupoMiembroIds) && entrega.grupoMiembroIds.includes(user.uid);
      if (entrega.estudianteId !== user.uid && !puedeEditarGrupo) {
        throw new Error('NO_AUTORIZADO');
      }

      let estado = entrega.estado === 'tarde' ? 'tarde' : 'entregado';
      const limit = pub.fechaEntrega?.toDate ? pub.fechaEntrega.toDate() : (pub.fechaEntrega ? new Date(pub.fechaEntrega) : null);
      if (limit && new Date() > limit) {
        if (!pub.permiteEntregaTardia) throw new Error('FUERA_DE_TIEMPO');
        estado = 'tarde';
      }

      const payload = {
        contenido: data.contenido || '',
        archivos: Array.isArray(data.archivos) ? data.archivos : [],
        actualizadoPorId: user.uid,
        actualizadoPorNombre: profile.displayName || user.displayName || user.email,
        estado,
        entregadoAt: fv.serverTimestamp(),
        updatedAt: fv.serverTimestamp()
      };
      await ctx.db.collection(ENTREGAS).doc(entregaId).update(payload);
      invalidateCache('entregas_');
      invalidateCache('entregas_pub_');
      invalidateCache('entregas_est_');
      invalidateCache('tabla_cal_');
      invalidateCache('community_entregas_');
    }

    /**
     * Califica una entrega (docente)
     * @param {object} ctx
     * @param {string} entregaId
     * @param {number} calificacion
     * @param {string} retroalimentacion
     */
    async function calificarEntrega(ctx, entregaId, calificacion, retroalimentacion) {
      const entregaSnap = await ctx.db.collection(ENTREGAS).doc(entregaId).get();
      if (!entregaSnap.exists) throw new Error('ENTREGA_NO_ENCONTRADA');
      const entrega = { id: entregaSnap.id, ...entregaSnap.data() };
      await _ensureClaseDocente(ctx, entrega.claseId);
      await ctx.db.collection(ENTREGAS).doc(entregaId).update({
        calificacion,
        retroalimentacion: retroalimentacion || '',
        calificadoPor: ctx.auth.currentUser.uid,
        calificadoAt: fv.serverTimestamp(),
        estado: 'calificado',
        updatedAt: fv.serverTimestamp()
      });
      invalidateCache('entregas_');
      invalidateCache('entregas_pub_');
      invalidateCache('entregas_est_');
      invalidateCache('tabla_cal_');
      invalidateCache('community_entregas_');
    }

    /**
     * Obtiene entregas por publicacion (docente, cache 15s, limite 60)
     * @param {object} ctx
     * @param {string} pubId
     * @param {number} [limit_]
     * @returns {Promise<Array>}
     */
    async function getEntregasPorPublicacion(ctx, pubId, limit_) {
      const pub = await getPublicacion(ctx, pubId);
      if (!pub) throw new Error('PUBLICACION_NO_ENCONTRADA');
      await _ensureClaseDocente(ctx, pub.claseId);
      return cached(`entregas_pub_${pubId}`, async () => {
        const snap = await ctx.db.collection(ENTREGAS)
          .where('publicacionId', '==', pubId)
          .limit(limit_ || 60)
          .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => _entregaSortValue(b) - _entregaSortValue(a));
      }, 15000);
    }

    /**
     * Obtiene la entrega de un estudiante para una publicacion
     * @param {object} ctx
     * @param {string} pubId
     * @param {string} uid
     * @returns {Promise<object|null>}
     */
    async function getMiEntrega(ctx, pubId, uid) {
      const snap = await ctx.db.collection(ENTREGAS)
        .where('publicacionId', '==', pubId)
        .where('estudianteId', '==', uid)
        .limit(1).get();
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

      const pub = await getPublicacion(ctx, pubId);
      if (!pub?.grupoId) return null;

      const grupo = await getMiGrupo(ctx, pub.claseId, uid);
      if (!grupo || grupo.id !== pub.grupoId) return null;

      const grupoSnap = await ctx.db.collection(ENTREGAS)
        .where('publicacionId', '==', pubId)
        .where('grupoId', '==', grupo.id)
        .limit(1).get();
      if (grupoSnap.empty) return null;
      return { id: grupoSnap.docs[0].id, ...grupoSnap.docs[0].data(), isGroupDelivery: true };
    }

    /**
     * Obtiene entregas de un estudiante en una clase (portfolio, cache 15s)
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} uid
     * @param {number} [limit_]
     * @returns {Promise<Array>}
     */
    async function getEntregasPorEstudiante(ctx, claseId, uid, limit_) {
      return cached(`entregas_est_${claseId}_${uid}`, async () => {
        const snap = await ctx.db.collection(ENTREGAS)
          .where('claseId', '==', claseId)
          .where('estudianteId', '==', uid)
          .orderBy('entregadoAt', 'desc')
          .limit(limit_ || 50)
          .get();
        const entregas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const miGrupo = await getMiGrupo(ctx, claseId, uid);
        if (miGrupo) {
          const snapGrupo = await ctx.db.collection(ENTREGAS)
            .where('claseId', '==', claseId)
            .where('grupoId', '==', miGrupo.id)
            .limit(limit_ || 50)
            .get();
          entregas.push(...snapGrupo.docs.map(d => ({ id: d.id, ...d.data(), isGroupDelivery: true })));
        }
        return _mergeEntregas(entregas);
      }, 15000);
    }

    /**
     * Obtiene todas las entregas de un estudiante (portfolio global)
     * @param {object} ctx
     * @param {string} uid
     * @param {number} [limit_]
     * @returns {Promise<Array>}
     */
    async function getEntregasGlobal(ctx, uid, limit_) {
      const snap = await ctx.db.collection(ENTREGAS)
        .where('estudianteId', '==', uid)
        .orderBy('entregadoAt', 'desc')
        .limit(limit_ || 100)
        .get();
      const entregas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const gruposSnap = await ctx.db.collection(GRUPOS)
        .where('miembroIds', 'array-contains', uid)
        .limit(50)
        .get();
      const grupoIds = gruposSnap.docs.map(d => d.id);
      if (grupoIds.length) {
        const batches = [];
        for (let i = 0; i < grupoIds.length; i += 10) {
          const batch = grupoIds.slice(i, i + 10);
          batches.push(ctx.db.collection(ENTREGAS).where('grupoId', 'in', batch).limit(limit_ || 100).get());
        }
        const snaps = await Promise.all(batches);
        snaps.forEach(groupSnap => {
          entregas.push(...groupSnap.docs.map(d => ({ id: d.id, ...d.data(), isGroupDelivery: true })));
        });
      }
      return _mergeEntregas(entregas).slice(0, limit_ || 100);
    }

    // ══════════════════════════════════════════════════════════
    //  COMENTARIOS
    // ══════════════════════════════════════════════════════════

    /**
     * Agrega un comentario a una publicacion
     * @param {object} ctx
     * @param {string} pubId
     * @param {string} contenido
     * @returns {Promise<DocumentReference>}
     */
    async function addComentario(ctx, pubId, contenido, replyTo) {
      const user = ctx.auth.currentUser;
      const profile = ctx.profile || {};
      const doc = {
        publicacionId: pubId,
        autorId:    user.uid,
        autorNombre: profile.displayName || user.displayName || user.email || '',
        autorFoto:  profile.photoURL || user.photoURL || null,
        contenido,
        createdAt: fv.serverTimestamp()
      };
      if (replyTo && replyTo.id) doc.replyTo = { id: replyTo.id, autorNombre: replyTo.autorNombre || '' };
      return ctx.db.collection(COMMENTS).add(doc);
    }

    /**
     * Stream de comentarios (real-time, limite 50)
     * @param {object} ctx
     * @param {string} pubId
     * @param {Function} cb
     * @param {number} [limit_]
     * @returns {Function} unsubscribe
     */
    function streamComentarios(ctx, pubId, cb, limit_) {
      return ctx.db.collection(COMMENTS)
        .where('publicacionId', '==', pubId)
        .orderBy('createdAt', 'asc')
        .limit(limit_ || 50)
        .onSnapshot(cb);
    }

    /**
     * Elimina un comentario
     * @param {object} ctx
     * @param {string} commentId
     */
    async function deleteComentario(ctx, commentId) {
      await ctx.db.collection(COMMENTS).doc(commentId).delete();
    }

    // ══════════════════════════════════════════════════════════
    //  VOTOS (ENCUESTAS)
    // ══════════════════════════════════════════════════════════

    /**
     * Registra un voto (ID determinista previene doble voto)
     * @param {object} ctx
     * @param {string} pubId
     * @param {number} opcionIndex
     */
    async function votar(ctx, pubId, opcionIndex) {
      const uid = ctx.auth.currentUser.uid;
      const docId = `${pubId}_${uid}`;
      await ctx.db.collection(VOTOS).doc(docId).set({
        publicacionId: pubId,
        userId: uid,
        opcionIndex,
        votedAt: fv.serverTimestamp()
      });
      invalidateCache('votos_');
    }

    /**
     * Obtiene resultados de una encuesta (cache 10s, limite 500)
     * @param {object} ctx
     * @param {string} pubId
     * @returns {Promise<{totals: object, miVoto: number|null, total: number}>}
     */
    async function getResultados(ctx, pubId) {
      return cached(`votos_${pubId}`, async () => {
        const snap = await ctx.db.collection(VOTOS)
          .where('publicacionId', '==', pubId)
          .limit(500)
          .get();
        const uid = ctx.auth.currentUser.uid;
        const totals = {};
        let miVoto = null;
        snap.docs.forEach(d => {
          const v = d.data();
          totals[v.opcionIndex] = (totals[v.opcionIndex] || 0) + 1;
          if (v.userId === uid) miVoto = v.opcionIndex;
        });
        return { totals, miVoto, total: snap.size };
      }, 10000);
    }

    // ══════════════════════════════════════════════════════════
    //  COMUNIDAD (Tareas visibles por carrera)
    // ══════════════════════════════════════════════════════════

    /**
     * Obtiene tareas visibles para una carrera (cache 30s, limite 20)
     * @param {object} ctx
     * @param {string} carrera
     * @param {number} [limit_]
     * @returns {Promise<Array>}
     */
    async function getCommunityTasks(ctx, carrera, limit_) {
      const careerKey = String(carrera || '').trim().toUpperCase();
      if (!careerKey) return [];
      return cached(`community_${careerKey}`, async () => {
        const fetchLimit = Math.max((limit_ || 20) * 4, 60);
        const snap = await ctx.db.collection(PUBS)
          .where('visibleCarrera', '==', true)
          .limit(fetchLimit)
          .get();
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const claseIds = [...new Set(tasks.map(task => task.claseId).filter(Boolean))];
        const clases = await Promise.all(claseIds.map(claseId => getClase(ctx, claseId).catch(() => null)));
        const clasesMap = {};
        clases.forEach(clase => {
          if (clase?.id) clasesMap[clase.id] = clase;
        });
        return tasks
          .filter(task => task.tipo === 'tarea')
          .filter(task => clasesMap[task.claseId]?.archivada !== true)
          .filter(task => {
            const clase = clasesMap[task.claseId] || {};
            return _matchesCareer(task.carrera, careerKey)
              || _matchesCareer(task.carreraNombre, careerKey)
              || _matchesCareer(clase.carrera, careerKey)
              || _matchesCareer(clase.carreraNombre, careerKey);
          })
          .sort((a, b) => _tsValue(b.createdAt) - _tsValue(a.createdAt))
          .slice(0, limit_ || 20)
          .map(task => ({
            ...task,
            claseTitulo: task.claseTitulo || clasesMap[task.claseId]?.titulo || 'Clase',
            claseColor: task.claseColor || clasesMap[task.claseId]?.color || '#6366f1',
            claseCarrera: task.carreraNombre || clasesMap[task.claseId]?.carreraNombre || task.carrera || clasesMap[task.claseId]?.carrera || ''
          }));
      }, 30000);
    }

    /**
     * Obtiene entregas publicas de tarea comunitaria (cache 30s, limite 30)
     * @param {object} ctx
     * @param {string} pubId
     * @param {number} [limit_]
     * @returns {Promise<Array>}
     */
    async function getCommunityEntregas(ctx, pubId, limit_) {
      return cached(`community_entregas_${pubId}`, async () => {
        const snap = await ctx.db.collection(ENTREGAS)
          .where('publicacionId', '==', pubId)
          .where('estado', '==', 'calificado')
          .orderBy('calificacion', 'desc')
          .limit(limit_ || 30)
          .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }, 30000);
    }

    /**
     * Obtiene publicaciones recientes de todas las clases en las que el usuario es miembro.
     * Usado por el estudiante en la tab Comunidad.
     * @param {object} ctx
     * @param {number} [limit_] - Máximo de items a retornar (default 10)
     * @returns {Promise<Array>} Publicaciones ordenadas por fecha desc con claseTitulo
     */
    async function getComunidadRecientes(ctx, limit_) {
      const uid = ctx.auth.currentUser.uid;
      const lim = limit_ || 10;
      return cached(`comunidad_recientes_${uid}_${lim}`, async () => {
        // Obtener clases del usuario
        const clases = await getMisClases(ctx, uid, 20);
        if (!clases.length) return [];

        const promises = clases.map(async clase => {
          try {
            const snap = await ctx.db.collection(PUBS)
              .where('claseId', '==', clase.id)
              .where('tipo', 'in', ['aviso', 'anuncio', 'material', 'discusion'])
              .orderBy('createdAt', 'desc')
              .limit(3)
              .get();
            return snap.docs.map(d => ({
              id: d.id,
              ...d.data(),
              claseTitulo: clase.titulo,
              claseId: clase.id
            }));
          } catch (err) {
            console.warn('[AulaService] getComunidadRecientes skipped class:', clase.id, err?.code || err?.message || err);
            return [];
          }
        });

        const resultados = await Promise.all(promises);
        const todos = resultados.flat();

        // Ordenar por createdAt desc y limitar
        todos.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return tb - ta;
        });

        return todos.slice(0, lim);
      }, 300000); // cache 5 min
    }

    // ══════════════════════════════════════════════════════════
    //  PORTFOLIO
    // ══════════════════════════════════════════════════════════

    /**
     * Portfolio de un estudiante en una clase
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} uid
     * @returns {Promise<object>} { entregas, stats }
     */
    async function getPortfolioData(ctx, claseId, uid) {
      const entregas = await _hydrateEntregas(ctx, await getEntregasPorEstudiante(ctx, claseId, uid, 100));
      const calificadas = entregas.filter(e => e.estado === 'calificado' && e.calificacion != null);
      const promedio = calificadas.length > 0
        ? Math.round(calificadas.reduce((sum, e) => sum + e.calificacion, 0) / calificadas.length)
        : 0;
      const aTiempo = entregas.filter(e => e.estado !== 'tarde').length;
      const pctATiempo = entregas.length > 0 ? Math.round((aTiempo / entregas.length) * 100) : 100;
      return {
        entregas,
        stats: { totalEntregas: entregas.length, calificadas: calificadas.length, promedio, pctATiempo }
      };
    }

    /**
     * Portfolio global del estudiante
     * @param {object} ctx
     * @param {string} uid
     * @returns {Promise<object>} { entregas, stats, porClase }
     */
    async function getPortfolioGlobal(ctx, uid) {
      const entregas = await _hydrateEntregas(ctx, await getEntregasGlobal(ctx, uid, 200));
      const calificadas = entregas.filter(e => e.estado === 'calificado' && e.calificacion != null);
      const promedio = calificadas.length > 0
        ? Math.round(calificadas.reduce((sum, e) => sum + e.calificacion, 0) / calificadas.length)
        : 0;
      const porClase = {};
      entregas.forEach(e => {
        if (!porClase[e.claseId]) porClase[e.claseId] = [];
        porClase[e.claseId].push(e);
      });
      return {
        entregas,
        stats: { totalEntregas: entregas.length, calificadas: calificadas.length, promedio },
        porClase
      };
    }

    /**
     * Tabla de calificaciones de una clase (docente). Una sola carga optimizada.
     * @param {object} ctx
     * @param {string} claseId
     * @returns {Promise<object>} { tareas, estudiantes, entregasMap }
     */
    async function getTablaCalificaciones(ctx, claseId) {
      await _ensureClaseDocente(ctx, claseId);
      return cached(`tabla_cal_${claseId}`, async () => {
        const [tareasSnap, miembros, grupos, entregasSnap] = await Promise.all([
          ctx.db.collection(PUBS)
            .where('claseId', '==', claseId)
            .where('tipo', '==', 'tarea')
            .orderBy('createdAt', 'asc')
            .limit(50)
            .get(),
          getMiembros(ctx, claseId, 100),
          getGrupos(ctx, claseId),
          ctx.db.collection(ENTREGAS)
            .where('claseId', '==', claseId)
            .limit(2000)
            .get()
        ]);
        const tareas = tareasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const estudiantes = miembros.filter(m => m.rol === 'estudiante');
        const gruposMap = {};
        grupos.forEach(grupo => { gruposMap[grupo.id] = grupo; });
        const grupoPorEstudiante = {};
        grupos.forEach(grupo => {
          (grupo.miembroIds || []).forEach(uid => {
            grupoPorEstudiante[uid] = grupo.id;
          });
        });
        const entregasMap = {};
        const entregasGrupo = {};
        entregasSnap.docs.forEach(d => {
          const e = d.data();
          const entrega = { id: d.id, ...e };
          if (e.grupoId) {
            const key = `${e.publicacionId}_${e.grupoId}`;
            entregasGrupo[key] = _pickLatestEntrega(entregasGrupo[key], entrega);
          } else {
            const key = `${e.estudianteId}_${e.publicacionId}`;
            entregasMap[key] = _pickLatestEntrega(entregasMap[key], entrega);
          }
        });
        tareas.forEach(tarea => {
          estudiantes.forEach(estudiante => {
            const key = `${estudiante.userId}_${tarea.id}`;
            if (tarea.grupoId) {
              const grupoEstudianteId = grupoPorEstudiante[estudiante.userId] || null;
              if (grupoEstudianteId !== tarea.grupoId) {
                entregasMap[key] = {
                  notApplicable: true,
                  grupoId: tarea.grupoId,
                  grupoNombre: tarea.grupoNombre || gruposMap[tarea.grupoId]?.nombre || 'Grupo'
                };
                return;
              }
              const entregaGrupo = entregasGrupo[`${tarea.id}_${tarea.grupoId}`];
              if (entregaGrupo) {
                entregasMap[key] = {
                  ...entregaGrupo,
                  isGroupDelivery: true,
                  grupoNombre: entregaGrupo.grupoNombre || tarea.grupoNombre || gruposMap[tarea.grupoId]?.nombre || 'Grupo'
                };
              }
            }
          });
        });
        return { tareas, estudiantes, entregasMap };
      }, 20000);
    }

    // ══════════════════════════════════════════════════════════
    //  PLANTILLAS DE PUBLICACIÓN
    // ══════════════════════════════════════════════════════════

    const PLANTILLAS = 'aula-plantillas';

    /**
     * Guarda una publicación como plantilla reutilizable del docente.
     * @param {object} ctx
     * @param {object} pub - Datos de la publicación (tipo, titulo, contenido, archivos, rubrica, puntajeMax)
     * @returns {Promise<DocumentReference>}
     */
    async function guardarPlantilla(ctx, pub) {
      const uid = ctx.auth.currentUser.uid;
      // Verificar límite de 20 plantillas por docente
      const existentes = await ctx.db.collection(PLANTILLAS).where('docenteId', '==', uid).limit(21).get();
      if (existentes.size >= 20) throw new Error('LIMITE_PLANTILLAS');

      return ctx.db.collection(PLANTILLAS).add({
        docenteId:  uid,
        tipo:       pub.tipo       || 'tarea',
        titulo:     pub.titulo     || '',
        contenido:  pub.contenido  || '',
        archivos:   _normalizeArchivos(pub.archivos),
        rubrica:    pub.rubrica    || null,
        puntajeMax: pub.puntajeMax || 100,
        permiteEntregaTardia: Boolean(pub.permiteEntregaTardia),
        visibleCarrera: Boolean(pub.visibleCarrera),
        usos:       0,
        createdAt:  fv.serverTimestamp()
      });
    }

    /**
     * Obtiene las plantillas del docente actual (max 20)
     * @param {object} ctx
     * @returns {Promise<Array>}
     */
    async function getPlantillas(ctx) {
      const uid  = ctx.auth.currentUser.uid;
      const snap = await ctx.db.collection(PLANTILLAS)
        .where('docenteId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    /**
     * Elimina una plantilla del docente.
     * @param {object} ctx
     * @param {string} plantillaId
     */
    async function eliminarPlantilla(ctx, plantillaId) {
      await ctx.db.collection(PLANTILLAS).doc(plantillaId).delete();
    }

    /**
     * Incrementa el contador de usos de una plantilla.
     * @param {object} ctx
     * @param {string} plantillaId
     */
    async function registrarUsoPlantilla(ctx, plantillaId) {
      await ctx.db.collection(PLANTILLAS).doc(plantillaId).update({
        usos: fv.increment(1)
      });
    }

    /**
     * Sube un archivo para adjuntarlo a una publicacion de Aula.
     * @param {object} ctx
     * @param {string} claseId
     * @param {File|Blob} file
     * @param {object} [options]
     * @param {Function} [options.onProgress]
     * @returns {Promise<object>}
     */
    async function uploadPublicacionArchivo(ctx, claseId, file, options) {
      await _ensureClaseDocente(ctx, claseId);
      const storage = ctx.storage || global.SIA?.storage;
      if (!storage?.ref || !file) throw new Error('STORAGE_NO_DISPONIBLE');
      const uid = ctx.auth.currentUser?.uid || 'anon';
      const safeName = `${Date.now()}_${_sanitizeFileName(file.name || 'archivo')}`;
      const ref = storage.ref().child(`aula-publicaciones/${uid}/${claseId}/${safeName}`);
      const task = ref.put(file, {
        contentType: file.type || 'application/octet-stream'
      });

      await new Promise((resolve, reject) => {
        task.on('state_changed',
          snap => {
            if (typeof options?.onProgress === 'function' && snap.totalBytes) {
              options.onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          reject,
          resolve
        );
      });

      const url = await ref.getDownloadURL();
      return {
        nombre: file.name || 'Archivo',
        url,
        tipo: 'file',
        mime: file.type || '',
        size: Number(file.size) || null,
        subtitulo: file.type || 'Archivo subido'
      };
    }

    // ══════════════════════════════════════════════════════════
    //  REACCIONES EN COMENTARIOS
    // ══════════════════════════════════════════════════════════

    const REACCIONES = 'aula-reacciones';

    /**
     * Agrega o elimina (toggle) una reacción emoji a un comentario.
     * @param {object} ctx
     * @param {string} comentarioId
     * @param {string} emoji
     */
    async function toggleReaccion(ctx, comentarioId, emoji) {
      const uid  = ctx.auth.currentUser.uid;
      const docId = `${comentarioId}_${uid}_${encodeURIComponent(emoji)}`;
      const ref  = ctx.db.collection(REACCIONES).doc(docId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
      } else {
        await ref.set({ comentarioId, userId: uid, emoji, createdAt: fv.serverTimestamp() });
      }
    }

    /**
     * Obtiene todas las reacciones de un comentario agrupadas por emoji.
     * @param {object} ctx
     * @param {string} comentarioId
     * @returns {Promise<Array>} [{ emoji, count, miReaccion }]
     */
    async function getReacciones(ctx, comentarioId) {
      const uid  = ctx.auth.currentUser.uid;
      const snap = await ctx.db.collection(REACCIONES)
        .where('comentarioId', '==', comentarioId)
        .limit(50).get();
      const grupos = {};
      snap.forEach(d => {
        const { emoji, userId } = d.data();
        if (!grupos[emoji]) grupos[emoji] = { count: 0, miReaccion: false };
        grupos[emoji].count++;
        if (userId === uid) grupos[emoji].miReaccion = true;
      });
      return Object.entries(grupos).map(([emoji, data]) => ({ emoji, ...data }));
    }

    // ══════════════════════════════════════════════════════════
    //  GRUPOS DE TRABAJO
    // ══════════════════════════════════════════════════════════

    /**
     * Crea un grupo de trabajo en una clase.
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} nombre
     * @param {Array<string>} miembroIds
     */
    async function createGrupo(ctx, claseId, nombre, miembroIds) {
      await _ensureClaseDocente(ctx, claseId);
      const uid = ctx.auth.currentUser.uid;
      const ref = await ctx.db.collection(GRUPOS).add({
        claseId, nombre, miembroIds, docenteId: uid,
        createdAt: fv.serverTimestamp()
      });
      invalidateCache(`grupos_${claseId}`);
      invalidateCache('grupo_');
      invalidateCache('tabla_cal_');
      return ref.id;
    }

    /**
     * Obtiene un grupo por ID.
     * @param {object} ctx
     * @param {string} grupoId
     * @returns {Promise<object|null>}
     */
    async function getGrupo(ctx, grupoId) {
      if (!grupoId) return null;
      return cached(`grupo_${grupoId}`, async () => {
        const snap = await ctx.db.collection(GRUPOS).doc(grupoId).get();
        return snap.exists ? { id: snap.id, ...snap.data() } : null;
      }, 60000);
    }

    /**
     * Obtiene todos los grupos de una clase (cached 60s).
     * @param {object} ctx
     * @param {string} claseId
     */
    async function getGrupos(ctx, claseId) {
      return cached(`grupos_${claseId}`, async () => {
        const snap = await ctx.db.collection(GRUPOS)
          .where('claseId', '==', claseId)
          .limit(100).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }, 60000);
    }

    /**
     * Actualiza nombre o miembros de un grupo.
     * @param {object} ctx
     * @param {string} grupoId
     * @param {object} data - { nombre?, miembroIds? }
     */
    async function updateGrupo(ctx, grupoId, data) {
      const grupo = await getGrupo(ctx, grupoId);
      if (!grupo) throw new Error('GRUPO_NO_ENCONTRADO');
      await _ensureClaseDocente(ctx, grupo.claseId);
      await ctx.db.collection(GRUPOS).doc(grupoId).update(data);
      // Invalidar caches relacionados (no sabemos el claseId exacto, invalidar todos)
      invalidateCache('grupos_');
      invalidateCache('grupo_');
      invalidateCache('tabla_cal_');
    }

    /**
     * Elimina un grupo.
     * @param {object} ctx
     * @param {string} grupoId
     * @param {string} claseId
     */
    async function deleteGrupo(ctx, grupoId, claseId) {
      await _ensureClaseDocente(ctx, claseId);
      await ctx.db.collection(GRUPOS).doc(grupoId).delete();
      invalidateCache(`grupos_${claseId}`);
      invalidateCache('grupo_');
      invalidateCache('tabla_cal_');
    }

    /**
     * Obtiene el grupo al que pertenece un estudiante en una clase.
     * @param {object} ctx
     * @param {string} claseId
     * @param {string} uid
     * @returns {Promise<object|null>}
     */
    async function getMiGrupo(ctx, claseId, uid) {
      const snap = await ctx.db.collection(GRUPOS)
        .where('claseId', '==', claseId)
        .where('miembroIds', 'array-contains', uid)
        .limit(1).get();
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    // ── API Publica ──
    return {
      clearCache, invalidateCache,
      createClase, getClase, updateClase, archivarClase, deleteClase, getClaseByCode, getMisClases, generateJoinCode,
      joinClase, joinClaseAsDocente, addMiembroByMatricula, addCoDocente, removeMiembro, getMiembros, isMiembro, getRolEnClase, streamMisClasesMembres, getEntregasPendientesByClase,
      createPublicacion, updatePublicacion, deletePublicacion,
      streamPublicaciones, getPublicaciones, getPublicacion, getPublicacionForClase, toggleFijada,
      submitEntrega, updateEntrega, calificarEntrega,
      getEntregasPorPublicacion, getMiEntrega, getEntregasPorEstudiante, getEntregasGlobal,
      addComentario, streamComentarios, deleteComentario,
      votar, getResultados,
      getCommunityTasks, getCommunityEntregas, getComunidadRecientes,
      getPortfolioData, getPortfolioGlobal, getTablaCalificaciones,
      guardarPlantilla, getPlantillas, eliminarPlantilla, registrarUsoPlantilla, uploadPublicacionArchivo,
      toggleReaccion, getReacciones,
      createGrupo, getGrupos, getGrupo, updateGrupo, deleteGrupo, getMiGrupo
    };

  })();

  global.AulaService = AulaService;
})(window);
