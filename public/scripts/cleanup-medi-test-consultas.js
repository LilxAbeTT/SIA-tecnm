/* global firebase, SIA */
(function attachMediCleanup(global) {
  const DEFAULT_BATCH_SIZE = 400;

  function getDb() {
    if (global.SIA?.db) return global.SIA.db;
    if (global.firebase?.firestore) return global.firebase.firestore();
    throw new Error('No se encontro Firebase Firestore en window.SIA ni en window.firebase.');
  }

  function getAuthUid() {
    return global.SIA?.auth?.currentUser?.uid || global.firebase?.auth?.().currentUser?.uid || null;
  }

  function toIsoDate(value) {
    try {
      if (!value) return '';
      if (typeof value?.toDate === 'function') return value.toDate().toISOString();
      if (value instanceof Date) return value.toISOString();
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString();
    } catch (_) {
      return '';
    }
  }

  function normalizeUpper(value) {
    return String(value || '').trim().toUpperCase();
  }

  function hasConsultationShape(data) {
    if (!data || typeof data !== 'object') return false;
    return Boolean(
      data.tipoServicio ||
      data.autorId ||
      data.diagnostico ||
      data.subjetivo ||
      data.objetivo ||
      data.plan ||
      data.createdAt ||
      data.estado
    );
  }

  function matchService(data, allowedServices) {
    if (!allowedServices?.length) return true;
    const service = String(data?.tipoServicio || '').trim().toLowerCase();
    return allowedServices.some((item) => service === String(item || '').trim().toLowerCase());
  }

  function matchTargetMatricula(data, targetMatricula) {
    if (!targetMatricula) return true;
    const matriculas = [
      data?.pacienteMatricula,
      data?.matricula,
      data?.studentMatricula
    ].map(normalizeUpper).filter(Boolean);
    return matriculas.includes(normalizeUpper(targetMatricula));
  }

  function buildPreviewRow(kind, path, id, data) {
    return {
      kind,
      id,
      path,
      servicio: data?.tipoServicio || '',
      fecha: toIsoDate(data?.createdAt || data?.fechaConsulta || data?.lastUpdate),
      autorId: data?.autorId || data?.profesionalId || '',
      profesional: data?.profesionalName || data?.autorEmail || '',
      matricula: data?.pacienteMatricula || data?.matricula || '',
      diagnostico: data?.diagnostico || ''
    };
  }

  async function chunkedBatchDelete(db, refs, batchSize) {
    let deleted = 0;
    for (let i = 0; i < refs.length; i += batchSize) {
      const chunk = refs.slice(i, i + batchSize);
      const batch = db.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
      deleted += chunk.length;
      console.log(`[cleanup-medi] Lote confirmado: ${deleted}/${refs.length}`);
    }
    return deleted;
  }

  async function cleanupMediTestConsultas(options = {}) {
    const db = getDb();
    const currentAuthUid = getAuthUid();
    const {
      targetUid,
      targetMatricula = '',
      dryRun = true,
      requireSelfAuthored = true,
      includeAppointments = false,
      includeLegacyRootDocs = true,
      allowedServices = ['Médico', 'Psicologico'],
      confirmationText = '',
      batchSize = DEFAULT_BATCH_SIZE
    } = options;

    if (!targetUid) {
      throw new Error('Falta targetUid.');
    }

    if (!dryRun && confirmationText !== `BORRAR ${targetUid}`) {
      throw new Error(`Para borrar de verdad, usa confirmationText: "BORRAR ${targetUid}"`);
    }

    const result = {
      dryRun,
      currentAuthUid,
      targetUid,
      targetMatricula: normalizeUpper(targetMatricula),
      counts: {
        consultas: 0,
        privadas: 0,
        legacy: 0,
        citas: 0,
        totalRefs: 0
      },
      preview: [],
      deletedRefs: 0
    };

    const refsToDelete = [];
    const seenPaths = new Set();
    const addRef = (ref) => {
      const path = ref.path || ref._path?.canonicalString?.();
      if (!path || seenPaths.has(path)) return;
      seenPaths.add(path);
      refsToDelete.push(ref);
    };

    const expedienteRef = db.collection('expedientes-clinicos').doc(targetUid);
    const consultasSnap = await expedienteRef.collection('consultas').get();
    consultasSnap.forEach((doc) => {
      const data = doc.data() || {};
      const matchesAuthor = !requireSelfAuthored || data.autorId === targetUid;
      const matchesMatricula = matchTargetMatricula(data, targetMatricula);
      const matchesService = matchService(data, allowedServices);
      if (!matchesAuthor || !matchesMatricula || !matchesService) return;

      result.counts.consultas += 1;
      result.preview.push(buildPreviewRow('consulta', doc.ref.path, doc.id, data));
      addRef(doc.ref);

      const privateRef = expedienteRef.collection('consultas-privadas').doc(doc.id);
      result.counts.privadas += 1;
      result.preview.push(buildPreviewRow('consulta-privada', privateRef.path, doc.id, data));
      addRef(privateRef);
    });

    if (includeLegacyRootDocs) {
      const legacySnap = await db.collection('expedientes-clinicos')
        .where('studentId', '==', targetUid)
        .get();

      legacySnap.forEach((doc) => {
        const data = doc.data() || {};
        const isMasterExpediente = doc.id === targetUid;
        const matchesAuthor = !requireSelfAuthored || data.autorId === targetUid;
        const matchesMatricula = matchTargetMatricula(data, targetMatricula);
        const matchesService = matchService(data, allowedServices);
        if (isMasterExpediente || !hasConsultationShape(data) || !matchesAuthor || !matchesMatricula || !matchesService) {
          return;
        }

        result.counts.legacy += 1;
        result.preview.push(buildPreviewRow('legacy-root', doc.ref.path, doc.id, data));
        addRef(doc.ref);
      });
    }

    if (includeAppointments) {
      const citasSnap = await db.collection('citas-medi')
        .where('studentId', '==', targetUid)
        .get();

      citasSnap.forEach((doc) => {
        const data = doc.data() || {};
        const sameProfessional = !requireSelfAuthored || data.profesionalId === targetUid;
        const matchesService = matchService(data, ['Médico', 'Psicologo', 'Psicologico']);
        if (!sameProfessional || !matchesService) return;

        result.counts.citas += 1;
        result.preview.push(buildPreviewRow('cita-medi', doc.ref.path, doc.id, data));
        addRef(doc.ref);
      });
    }

    result.counts.totalRefs = refsToDelete.length;
    result.preview.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

    console.group('[cleanup-medi] Preview');
    console.table(result.preview);
    console.log('[cleanup-medi] Resumen:', result.counts);
    console.log('[cleanup-medi] currentAuthUid:', currentAuthUid);
    console.groupEnd();

    if (dryRun) {
      return result;
    }

    result.deletedRefs = await chunkedBatchDelete(db, refsToDelete, Math.max(1, Math.min(batchSize, 450)));
    console.log('[cleanup-medi] Borrado finalizado:', result.deletedRefs);
    return result;
  }

  global.cleanupMediTestConsultas = cleanupMediTestConsultas;
  console.log(
    '[cleanup-medi] Helper listo. Ejemplo:\n' +
    "await cleanupMediTestConsultas({ targetUid: 'G7HRuNnlePNLYr26z9ad5jBgHA82', targetMatricula: '22380123' })"
  );
})(window);
