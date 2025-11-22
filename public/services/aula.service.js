(function (global) {
  const AulaService = (function () {
    const CURS = 'aula-cursos';
    const PROG = 'aula-progress';
    const INT = 'aula-intentos';
    const AVISOS = 'aula-avisos';
    const INSC = 'aula-inscripciones';

    const fv = SIA.FieldValue;
    const courseDoc = (ctx, cid) => ctx.db.collection(CURS).doc(cid);
    function ctxless() { return { db: SIA.db, auth: SIA.auth }; }
    // --- Helpers de Agregación (Fase 3) ---
    async function _getAdminCourseIds(ctx, uid) {
      const snap = await ctx.db.collection(CURS).where('creadoPor', '==', uid).get();
      return snap.docs.map(d => d.id);
    }

    async function getAdminDashboardStats(ctx, uid) {
      const courseIds = await _getAdminCourseIds(ctx, uid);
      if (courseIds.length === 0) {
        return { totalAlumnos: 0, tasaFinalizacion: 0, promedioGeneral: 0 };
      }

      // 1. Total Alumnos
      const inscSnap = await ctx.db.collection(INSC).where('cursoId', 'in', courseIds).get();
      const totalAlumnos = inscSnap.size;

      // 2. Tasa Finalización
      const progSnap = await ctx.db.collection(PROG).where('cursoId', 'in', courseIds).where('progressPct', '==', 100).get();
      const totalCompletados = progSnap.size;

      // 3. Promedio General
      const intentSnap = await ctx.db.collection(INT).where('cursoId', 'in', courseIds).get();
      let totalScore = 0;
      intentSnap.docs.forEach(d => { totalScore += (d.data().score || 0); });

      const tasaFinalizacion = totalAlumnos > 0 ? Math.round((totalCompletados / totalAlumnos) * 100) : 0;
      const promedioGeneral = intentSnap.size > 0 ? Math.round(totalScore / intentSnap.size) : 0;

      return { totalAlumnos, tasaFinalizacion, promedioGeneral };
    }

    async function getAdminActivityFeed(ctx, uid) {
      const courseIds = await _getAdminCourseIds(ctx, uid);
      if (courseIds.length === 0) return [];

      // Obtener últimos 5 inscritos y 5 intentos
      const inscSnap = await ctx.db.collection(INSC).where('cursoId', 'in', courseIds).orderBy('fechaInscripcion', 'desc').limit(5).get();
      const intentSnap = await ctx.db.collection(INT).where('cursoId', 'in', courseIds).orderBy('at', 'desc').limit(5).get();

      let feed = [];
      inscSnap.docs.forEach(d => {
        const data = d.data();
        feed.push({ type: 'insc', date: data.fechaInscripcion.toDate(), text: `<strong>${data.studentEmail}</strong> se inscribió a <strong>${data.cursoTitulo}</strong>.` });
      });

      intentSnap.docs.forEach(d => {
        const data = d.data();
        const icon = data.approved ? 'text-success bi-check-circle-fill' : 'text-danger bi-x-circle-fill';
        feed.push({ type: 'quiz', date: data.at.toDate(), text: `<i class="bi ${icon}"></i> <strong>${data.uid.split('@')[0]}</strong> obtuvo <strong>${data.score}%</strong> en el quiz del curso ${data.cursoId.slice(0, 5)}...` });
      });

      // Ordenar mezclados y devolver
      return feed.sort((a, b) => b.date - a.date).slice(0, 10);
    }

    async function generateReportData(ctx, uid, type, cursoId = null) {
      const courseIds = await _getAdminCourseIds(ctx, uid);
      if (courseIds.length === 0) return [];

      const [cursosSnap, inscSnap, progSnap, intentSnap] = await Promise.all([
        ctx.db.collection(CURS).where(SIA.FieldPath.documentId(), 'in', courseIds).get(),
        ctx.db.collection(INSC).where('cursoId', 'in', courseIds).get(),
        ctx.db.collection(PROG).where('cursoId', 'in', courseIds).get(),
        ctx.db.collection(INT).where('cursoId', 'in', courseIds).orderBy('at', 'desc').get()
      ]);

      const cursosMap = new Map(cursosSnap.docs.map(d => [d.id, d.data()]));
      const progMap = new Map(progSnap.docs.map(d => [`${d.data().uid}_${d.data().cursoId}`, d.data().progressPct || 0]));

      if (type === 'general_alumnos') {
        return inscSnap.docs.map(d => {
          const insc = d.data();
          return {
            Email: insc.studentEmail,
            Curso: insc.cursoTitulo || cursosMap.get(insc.cursoId)?.titulo || insc.cursoId,
            Fecha_Inscripcion: insc.fechaInscripcion.toDate().toLocaleDateString(),
            Progreso: progMap.get(`${insc.studentId}_${insc.cursoId}`) || 0
          };
        });
      }

      if (type === 'calificaciones_curso' && cursoId) {
        return intentSnap.docs
          .filter(d => d.data().cursoId === cursoId)
          .map(d => {
            const int = d.data();
            return {
              Email: int.uid,
              Curso: cursosMap.get(int.cursoId)?.titulo || int.cursoId,
              Fecha: int.at.toDate().toLocaleString(),
              Calificacion: int.score,
              Aprobado: int.approved ? 'SI' : 'NO'
            };
          });
      }
      return [];
    }

    // --- Gestión de Avisos ---
    // --- Gestión de Avisos ---
    // Stream para banner (por defecto 5 más recientes)
    function streamAvisos(ctx, cb, limit = 5) {
      let ref = ctx.db.collection(AVISOS).orderBy('createdAt', 'desc');
      if (typeof limit === 'number' && limit > 0) {
        ref = ref.limit(limit);
      }
      return ref.onSnapshot(cb);
    }

    // Listado completo para modal / reportería
    async function getAllAvisos(ctx) {
      const snap = await ctx.db.collection(AVISOS).orderBy('createdAt', 'desc').get();
      return snap.docs;
    }

    async function addAviso(ctx, texto, options = {}) {
      const user = ctx.auth.currentUser;
      if (!texto) throw new Error("Texto requerido");

      const now = new Date();
      const {
        tipo = 'aviso',
        prioridad = 2,              // 1 = alta, 2 = media, 3 = baja
        modulo = 'aula',
        duracionMin = 0,            // 0 = sin expiración
        activaDesde = now,
        activaHasta = null
      } = options;

      let hastaFinal = activaHasta;
      if (!hastaFinal && duracionMin > 0) {
        hastaFinal = new Date(activaDesde.getTime() + duracionMin * 60000);
      }

      const payload = {
        texto,
        tipo,
        prioridad,
        modulo,
        creadoPor: user.uid,
        autorEmail: user.email,
        createdAt: fv.serverTimestamp()
      };

      // Guardamos fechas sólo si vienen como Date válidas
      try {
        if (activaDesde instanceof Date) {
          payload.activaDesde = firebase.firestore.Timestamp.fromDate(activaDesde);
        }
        if (hastaFinal instanceof Date) {
          payload.activaHasta = firebase.firestore.Timestamp.fromDate(hastaFinal);
        }
      } catch (e) {
        console.warn('Aviso fechas inválidas', e);
      }

      await ctx.db.collection(AVISOS).add(payload);
    }

    async function deleteAviso(ctx, id) {
      await ctx.db.collection(AVISOS).doc(id).delete();
    }


    // --- Lecciones ---
    function streamLessons(ctx, cid, cb, errCb) {
      return courseDoc(ctx, cid).collection('lessons').orderBy('order').onSnapshot(cb, errCb);
    }
    async function addLesson(ctx, cid, data) {
      await courseDoc(ctx, cid).collection('lessons').add({ ...data, createdAt: fv.serverTimestamp() });
    }
    async function updateLesson(ctx, cid, lid, data) {
      await courseDoc(ctx, cid).collection('lessons').doc(lid).update({ ...data, updatedAt: fv.serverTimestamp() });
    }
    async function deleteLesson(ctx, cid, lid) {
      await courseDoc(ctx, cid).collection('lessons').doc(lid).delete();
    }

    // --- Quiz ---
    function streamQuizzes(ctx, cid, cb, errCb) {
      return courseDoc(ctx, cid).collection('quizzes').orderBy('createdAt').onSnapshot(cb, errCb);
    }
    async function addQuiz(ctx, cid, quiz) {
      await courseDoc(ctx, cid).collection('quizzes').add({ ...quiz, createdAt: fv.serverTimestamp() });
    }
    async function updateQuiz(ctx, cid, qid, quiz) {
      await courseDoc(ctx, cid).collection('quizzes').doc(qid).update(quiz);
    }
    async function deleteQuiz(ctx, cid, qid) {
      await courseDoc(ctx, cid).collection('quizzes').doc(qid).delete();
    }
    async function getFirstQuiz(ctx, cid) {
      const q = await courseDoc(ctx, cid).collection('quizzes').orderBy('createdAt').limit(1).get();
      return q.empty ? null : { id: q.docs[0].id, ...q.docs[0].data() };
    }
    async function getAttempts(ctx, uid, cid, quizId) {
      const snaps = await ctx.db.collection(INT).where('uid', '==', uid).where('cursoId', '==', cid).where('quizId', '==', quizId).get();
      return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    function evaluateQuiz(quiz, answers) {
      const total = quiz.items.length || 1;
      const ok = quiz.items.reduce((acc, q, i) => acc + (Number(answers[i]) === Number(q.correctaIndex) ? 1 : 0), 0);
      const score = Math.round((ok / total) * 100);
      return { ok, total, score, approved: score >= (quiz.minScore || 70) };
    }
    async function saveAttempt(ctx, uid, cid, quiz, result, answers) {
      await ctx.db.collection(INT).add({
        uid, cursoId: cid, quizId: quiz.id || null, score: result.score, approved: result.approved,
        answers, at: fv.serverTimestamp()
      });
    }

    // --- Progreso ---
    async function ensureProgress(ctx, uid, cid) {
      const id = `${uid}_${cid}`;
      const ref = ctx.db.collection(PROG).doc(id);
      const snap = await ref.get();
      if (!snap.exists) await ref.set({ uid, cursoId: cid, completed: [], progressPct: 0, updatedAt: fv.serverTimestamp() });
    }
    function streamProgress(ctx, uid, cid, cb) {
      const id = `${uid}_${cid}`;
      return ctx.db.collection(PROG).doc(id).onSnapshot(cb);
    }
    async function markLessonComplete(ctx, uid, cid, lid, totalLessons) {
      const id = `${uid}_${cid}`;
      const ref = ctx.db.collection(PROG).doc(id);
      await ctx.db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const done = new Set(snap.exists && Array.isArray(snap.data().completed) ? snap.data().completed : []);
        done.add(lid);
        const pct = Math.min(100, Math.round((done.size / Math.max(totalLessons, 1)) * 100));
        tx.set(ref, {
          uid,
          cursoId: cid,
          completed: Array.from(done),
          progressPct: pct,
          lastLessonId: lid,
          updatedAt: fv.serverTimestamp()
        }, { merge: true });
      });
    }

    async function updateLastViewed(ctx, uid, cid, lessonIndex, lessonId) {
      const id = `${uid}_${cid}`;
      await ctx.db.collection(PROG).doc(id).set({
        lastViewed: lessonIndex,
        lastLessonId: lessonId || null,
        updatedAt: fv.serverTimestamp()
      }, { merge: true });
    }


    // --- Misc / Certificados ---
    async function getCourse(ctx, cid) {
      const s = await courseDoc(ctx, cid).get(); return { id: s.id, ...s.data() };
    }
    async function issueCertificate(ctx, uid, cid, score) {
      const certRef = ctx.db.collection('aula-certificados');

      // 1) Buscar si ya existe un certificado para este alumno y curso
      const q = await certRef
        .where('uid', '==', uid)
        .where('cursoId', '==', cid)
        .limit(1)
        .get();

      let certDocRef;

      if (q.empty) {
        // Crear nuevo certificado
        certDocRef = await certRef.add({
          uid,
          cursoId: cid,
          score,
          issuedAt: fv.serverTimestamp()
        });
      } else {
        // Actualizar el existente con el nuevo score (si viene)
        certDocRef = q.docs[0].ref;
        const patch = { updatedAt: fv.serverTimestamp() };
        if (typeof score === 'number') {
          patch.score = score;
        }
        await certDocRef.set(patch, { merge: true });
      }

      // 2) Complementar con datos del curso (título, horas) para mostrar en la constancia
      try {
        const cSnap = await ctx.db.collection(CURS).doc(cid).get();
        if (cSnap.exists) {
          const cData = cSnap.data();
          const extra = {};
          if (cData.titulo) extra.cursoTitulo = cData.titulo;
          if (cData.duracionHoras) extra.horas = cData.duracionHoras;
          if (Object.keys(extra).length) {
            await certDocRef.set(extra, { merge: true });
          }
        }
      } catch (e) {
        console.warn('[AulaService] No se pudo complementar datos de certificado', e);
      }

      return certDocRef.id;
    }

    async function getCertificate(ctx, uid, cid) {
      const q = await ctx.db
        .collection('aula-certificados')
        .where('uid', '==', uid)
        .where('cursoId', '==', cid)
        .limit(1)
        .get();

      if (q.empty) return null;
      return { id: q.docs[0].id, ...q.docs[0].data() };
    }


    // --- Alumnos ---
    async function getCourseStudents(ctx, cid) {
      const snaps = await ctx.db.collection(INSC).where('cursoId', '==', cid).orderBy('fechaInscripcion', 'desc').get();
      const students = [];
      for (const doc of snaps.docs) {
        const d = doc.data();
        let email = d.studentEmail || 'Usuario';
        if (!d.studentEmail) { try { const u = await ctx.db.collection('usuarios').doc(d.studentId).get(); if (u.exists) email = u.data().email; } catch (e) { } }
        let pct = 0;
        try { const pDoc = await ctx.db.collection(PROG).doc(`${d.studentId}_${cid}`).get(); if (pDoc.exists) pct = pDoc.data().progressPct || 0; } catch (e) { }
        students.push({ enrollmentId: doc.id, uid: d.studentId, email: email, pct: pct, date: d.fechaInscripcion });
      }
      return students;
    }
    async function removeStudent(ctx, enrollmentId, uid, cid) {
      // 1) Borrar inscripción (siempre debe existir)
      await ctx.db.collection(INSC).doc(enrollmentId).delete();

      // 2) Borrar progreso solo si existe el doc
      const progRef = ctx.db.collection(PROG).doc(`${uid}_${cid}`);
      const progSnap = await progRef.get();
      if (progSnap.exists) {
        await progRef.delete();
      }
    }


    return {
      // Core
      streamLessons, addLesson, updateLesson, deleteLesson,
      addQuiz, getFirstQuiz, evaluateQuiz, saveAttempt, getAttempts,
      ensureProgress, streamProgress, markLessonComplete, updateLastViewed,
      getCourse, streamQuizzes, updateQuiz, deleteQuiz, issueCertificate,
      getCourseStudents, removeStudent, getCertificate,
      // Avisos / dashboard
      streamAvisos, getAllAvisos, addAviso, deleteAviso,
      _getAdminCourseIds, getAdminDashboardStats, getAdminActivityFeed, generateReportData
    };


  })();

  global.AulaService = AulaService;
})(window);