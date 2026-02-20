/* ============================================================
   AulaService — Capa de datos para Aula Virtual
   Firestore CRUD · Módulos > Lecciones · Streaks · Badges
   ============================================================ */
(function (global) {
  const AulaService = (function () {

    // ── Colecciones ──
    const CURS   = 'aula-cursos';
    const INSC   = 'aula-inscripciones';
    const PROG   = 'aula-progress';
    const CERT   = 'aula-certificados';
    const INT    = 'aula-intentos';
    const AVISOS = 'aula-avisos';
    const BADGES = 'aula-badges';

    const fv = SIA.FieldValue;
    const courseDoc = (ctx, cid) => ctx.db.collection(CURS).doc(cid);

    // ══════════════════════════════════════════════════════════
    //  CURSOS
    // ══════════════════════════════════════════════════════════
    async function getCourse(ctx, cid) {
      const s = await courseDoc(ctx, cid).get();
      return s.exists ? { id: s.id, ...s.data() } : null;
    }

    async function createCourse(ctx, data) {
      const user = ctx.auth.currentUser;
      const now = fv.serverTimestamp();
      return ctx.db.collection(CURS).add({
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : [],
        imagen: data.imagen || '',
        nivel: data.nivel || 'General',
        totalModulos: 0,
        totalLecciones: 0,
        creadoPor: user.uid,
        creadoEmail: user.email || null,
        publicado: true,
        createdAt: now,
        updatedAt: now
      });
    }

    async function updateCourse(ctx, cid, data) {
      await courseDoc(ctx, cid).update({ ...data, updatedAt: fv.serverTimestamp() });
    }

    async function deleteCourse(ctx, cid) {
      const inscSnap = await ctx.db.collection(INSC).where('cursoId', '==', cid).limit(1).get();
      if (!inscSnap.empty) throw new Error('TIENE_ALUMNOS');
      await courseDoc(ctx, cid).delete();
    }

    async function togglePublished(ctx, cid, current) {
      await courseDoc(ctx, cid).update({ publicado: !current });
      return !current;
    }

    // ══════════════════════════════════════════════════════════
    //  MÓDULOS (Capítulos)
    // ══════════════════════════════════════════════════════════
    function modulesRef(ctx, cid) {
      return courseDoc(ctx, cid).collection('modules');
    }

    function streamModules(ctx, cid, cb, errCb) {
      return modulesRef(ctx, cid).orderBy('order').onSnapshot(cb, errCb);
    }

    async function getModules(ctx, cid) {
      const snap = await modulesRef(ctx, cid).orderBy('order').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function addModule(ctx, cid, data) {
      const ref = await modulesRef(ctx, cid).add({
        titulo: data.titulo || '',
        descripcion: data.descripcion || '',
        order: typeof data.order === 'number' ? data.order : 999,
        createdAt: fv.serverTimestamp()
      });
      await _recountCourse(ctx, cid);
      return ref;
    }

    async function updateModule(ctx, cid, mid, data) {
      await modulesRef(ctx, cid).doc(mid).update({ ...data, updatedAt: fv.serverTimestamp() });
    }

    async function deleteModule(ctx, cid, mid) {
      const lessonsSnap = await modulesRef(ctx, cid).doc(mid).collection('lessons').get();
      const batch = ctx.db.batch();
      lessonsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(modulesRef(ctx, cid).doc(mid));
      await batch.commit();
      await _recountCourse(ctx, cid);
    }

    // ══════════════════════════════════════════════════════════
    //  LECCIONES (dentro de módulo)
    // ══════════════════════════════════════════════════════════
    function lessonsRef(ctx, cid, mid) {
      return courseDoc(ctx, cid).collection('modules').doc(mid).collection('lessons');
    }

    function streamLessons(ctx, cid, mid, cb, errCb) {
      return lessonsRef(ctx, cid, mid).orderBy('order').onSnapshot(cb, errCb);
    }

    async function getAllLessons(ctx, cid) {
      const mods = await getModules(ctx, cid);
      const all = [];
      for (const m of mods) {
        const snap = await lessonsRef(ctx, cid, m.id).orderBy('order').get();
        snap.docs.forEach(d => {
          all.push({ id: d.id, moduleId: m.id, moduleTitulo: m.titulo, ...d.data() });
        });
      }
      return all;
    }

    async function addLesson(ctx, cid, mid, data) {
      const ref = await lessonsRef(ctx, cid, mid).add({
        title: data.title || '',
        order: typeof data.order === 'number' ? data.order : 999,
        contentType: data.contentType || 'mixed',
        html: data.html || '',
        resources: Array.isArray(data.resources) ? data.resources : [],
        createdAt: fv.serverTimestamp()
      });
      await _recountCourse(ctx, cid);
      return ref;
    }

    async function updateLesson(ctx, cid, mid, lid, data) {
      await lessonsRef(ctx, cid, mid).doc(lid).update({ ...data, updatedAt: fv.serverTimestamp() });
    }

    async function deleteLesson(ctx, cid, mid, lid) {
      await lessonsRef(ctx, cid, mid).doc(lid).delete();
      await _recountCourse(ctx, cid);
    }

    async function _recountCourse(ctx, cid) {
      try {
        const mods = await modulesRef(ctx, cid).get();
        let totalLecciones = 0;
        for (const m of mods.docs) {
          const ls = await m.ref.collection('lessons').get();
          totalLecciones += ls.size;
        }
        await courseDoc(ctx, cid).update({
          totalModulos: mods.size,
          totalLecciones
        });
      } catch (_) {}
    }

    // ══════════════════════════════════════════════════════════
    //  QUIZZES
    // ══════════════════════════════════════════════════════════
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
      const snap = await ctx.db.collection(INT)
        .where('uid', '==', uid)
        .where('cursoId', '==', cid)
        .where('quizId', '==', quizId)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    function evaluateQuiz(quiz, answers) {
      const total = quiz.items.length || 1;
      const ok = quiz.items.reduce((acc, q, i) =>
        acc + (Number(answers[i]) === Number(q.correctaIndex) ? 1 : 0), 0);
      const score = Math.round((ok / total) * 100);
      return { ok, total, score, approved: score >= (quiz.minScore || 70) };
    }

    async function saveAttempt(ctx, uid, cid, quiz, result, answers) {
      await ctx.db.collection(INT).add({
        uid, cursoId: cid, quizId: quiz.id || null,
        score: result.score, approved: result.approved,
        answers, at: fv.serverTimestamp()
      });
    }

    // ══════════════════════════════════════════════════════════
    //  PROGRESO
    // ══════════════════════════════════════════════════════════
    async function ensureProgress(ctx, uid, cid) {
      const id = `${uid}_${cid}`;
      const ref = ctx.db.collection(PROG).doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({
          uid, cursoId: cid,
          completedLessons: [],
          completedModules: [],
          progressPct: 0,
          lastModuleId: null,
          lastLessonId: null,
          streak: { current: 0, best: 0, lastDate: null },
          updatedAt: fv.serverTimestamp()
        });
      }
    }

    function streamProgress(ctx, uid, cid, cb) {
      return ctx.db.collection(PROG).doc(`${uid}_${cid}`).onSnapshot(cb);
    }

    async function markLessonComplete(ctx, uid, cid, lid, totalLessons) {
      const id = `${uid}_${cid}`;
      const ref = ctx.db.collection(PROG).doc(id);
      await ctx.db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const done = new Set(Array.isArray(data.completedLessons) ? data.completedLessons : []);
        done.add(lid);
        const pct = Math.min(100, Math.round((done.size / Math.max(totalLessons, 1)) * 100));
        tx.set(ref, {
          uid, cursoId: cid,
          completedLessons: Array.from(done),
          progressPct: pct,
          lastLessonId: lid,
          updatedAt: fv.serverTimestamp()
        }, { merge: true });
      });
    }

    async function markModuleComplete(ctx, uid, cid, mid) {
      const id = `${uid}_${cid}`;
      const ref = ctx.db.collection(PROG).doc(id);
      await ctx.db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const done = new Set(Array.isArray(data.completedModules) ? data.completedModules : []);
        done.add(mid);
        tx.set(ref, { completedModules: Array.from(done), updatedAt: fv.serverTimestamp() }, { merge: true });
      });
    }

    async function updateLastViewed(ctx, uid, cid, moduleId, lessonId) {
      await ctx.db.collection(PROG).doc(`${uid}_${cid}`).set({
        lastModuleId: moduleId || null,
        lastLessonId: lessonId || null,
        updatedAt: fv.serverTimestamp()
      }, { merge: true });
    }

    // ══════════════════════════════════════════════════════════
    //  STREAKS
    // ══════════════════════════════════════════════════════════
    async function updateStreak(ctx, uid, cid) {
      const id = `${uid}_${cid}`;
      const ref = ctx.db.collection(PROG).doc(id);
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      const streak = data.streak || { current: 0, best: 0, lastDate: null };

      const today = new Date().toISOString().slice(0, 10);
      const lastDate = streak.lastDate || '';

      if (lastDate === today) return streak;

      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let newCurrent = lastDate === yesterday ? streak.current + 1 : 1;
      const newBest = Math.max(streak.best, newCurrent);

      const newStreak = { current: newCurrent, best: newBest, lastDate: today };
      await ref.set({ streak: newStreak, updatedAt: fv.serverTimestamp() }, { merge: true });
      return newStreak;
    }

    // ══════════════════════════════════════════════════════════
    //  INSCRIPCIONES
    // ══════════════════════════════════════════════════════════
    async function enroll(ctx, uid, email, cursoId, cursoTitulo) {
      const exists = await ctx.db.collection(INSC)
        .where('studentId', '==', uid)
        .where('cursoId', '==', cursoId)
        .limit(1).get();
      if (!exists.empty) throw new Error('YA_INSCRITO');

      await ctx.db.collection(INSC).add({
        studentId: uid,
        studentEmail: email,
        cursoId, cursoTitulo,
        fechaInscripcion: fv.serverTimestamp()
      });
    }

    async function unenroll(ctx, enrollmentId, uid, cid) {
      await ctx.db.collection(INSC).doc(enrollmentId).delete();
      const progRef = ctx.db.collection(PROG).doc(`${uid}_${cid}`);
      const progSnap = await progRef.get();
      if (progSnap.exists) await progRef.delete();
    }

    async function getCourseStudents(ctx, cid) {
      const snaps = await ctx.db.collection(INSC).where('cursoId', '==', cid).orderBy('fechaInscripcion', 'desc').get();
      const students = [];
      for (const doc of snaps.docs) {
        const d = doc.data();
        let email = d.studentEmail || 'Usuario';
        if (!d.studentEmail) {
          try {
            const u = await ctx.db.collection('usuarios').doc(d.studentId).get();
            if (u.exists) email = u.data().email;
          } catch (_) {}
        }
        let pct = 0;
        try {
          const pDoc = await ctx.db.collection(PROG).doc(`${d.studentId}_${cid}`).get();
          if (pDoc.exists) pct = pDoc.data().progressPct || 0;
        } catch (_) {}
        students.push({ enrollmentId: doc.id, uid: d.studentId, email, pct, date: d.fechaInscripcion });
      }
      return students;
    }

    // ══════════════════════════════════════════════════════════
    //  CERTIFICADOS
    // ══════════════════════════════════════════════════════════
    async function issueCertificate(ctx, uid, cid, score) {
      const certRef = ctx.db.collection(CERT);
      const q = await certRef.where('uid', '==', uid).where('cursoId', '==', cid).limit(1).get();

      let certDocRef;
      if (q.empty) {
        certDocRef = await certRef.add({ uid, cursoId: cid, score, issuedAt: fv.serverTimestamp() });
      } else {
        certDocRef = q.docs[0].ref;
        const patch = { updatedAt: fv.serverTimestamp() };
        if (typeof score === 'number') patch.score = score;
        await certDocRef.set(patch, { merge: true });
      }

      try {
        const cSnap = await courseDoc(ctx, cid).get();
        if (cSnap.exists) {
          const cData = cSnap.data();
          const extra = {};
          if (cData.titulo) extra.cursoTitulo = cData.titulo;
          if (cData.duracionHoras) extra.horas = cData.duracionHoras;
          if (Object.keys(extra).length) await certDocRef.set(extra, { merge: true });
        }
      } catch (_) {}

      return certDocRef.id;
    }

    async function getCertificate(ctx, uid, cid) {
      const q = await ctx.db.collection(CERT).where('uid', '==', uid).where('cursoId', '==', cid).limit(1).get();
      if (q.empty) return null;
      return { id: q.docs[0].id, ...q.docs[0].data() };
    }

    // ══════════════════════════════════════════════════════════
    //  BADGES
    // ══════════════════════════════════════════════════════════
    const BADGE_DEFS = [
      { type: 'first_course',   label: 'Primer Curso',   icon: 'bi-star-fill',          color: '#FFD700' },
      { type: 'streak_7',       label: 'Racha 7 Dias',   icon: 'bi-fire',               color: '#FF6B35' },
      { type: 'perfect_score',  label: 'Puntuacion 100', icon: 'bi-bullseye',           color: '#00D0FF' },
      { type: 'five_courses',   label: '5 Cursos',       icon: 'bi-collection-fill',    color: '#8B5CF6' },
      { type: 'speed_learner',  label: 'Veloz',          icon: 'bi-lightning-charge-fill', color: '#F59E0B' }
    ];

    function getBadgeDefs() { return BADGE_DEFS; }

    async function getUserBadges(ctx, uid) {
      const snap = await ctx.db.collection(BADGES).where('uid', '==', uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    async function checkAndAwardBadges(ctx, uid, event) {
      const awarded = [];
      const existing = await getUserBadges(ctx, uid);
      const has = type => existing.some(b => b.type === type);

      async function award(type, cursoId) {
        if (has(type)) return;
        const docId = `${uid}_${type}`;
        await ctx.db.collection(BADGES).doc(docId).set({
          uid, type,
          cursoId: cursoId || null,
          unlockedAt: fv.serverTimestamp()
        });
        const def = BADGE_DEFS.find(b => b.type === type);
        awarded.push(def || { type });
      }

      if (event.type === 'course_complete') {
        const certSnap = await ctx.db.collection(CERT).where('uid', '==', uid).get();
        const total = certSnap.size;
        if (total >= 1) await award('first_course', event.cursoId);
        if (total >= 5) await award('five_courses', event.cursoId);
      }

      if (event.type === 'quiz_perfect' && event.score === 100) {
        await award('perfect_score', event.cursoId);
      }

      if (event.type === 'streak_update' && event.streak >= 7) {
        await award('streak_7');
      }

      if (event.type === 'speed_complete') {
        await award('speed_learner', event.cursoId);
      }

      return awarded;
    }

    // ══════════════════════════════════════════════════════════
    //  AVISOS
    // ══════════════════════════════════════════════════════════
    function streamAvisos(ctx, cb, limit) {
      let ref = ctx.db.collection(AVISOS).orderBy('createdAt', 'desc');
      if (typeof limit === 'number' && limit > 0) ref = ref.limit(limit);
      return ref.onSnapshot(cb);
    }

    async function addAviso(ctx, texto, options) {
      const user = ctx.auth.currentUser;
      if (!texto) throw new Error('Texto requerido');
      options = options || {};

      const now = new Date();
      const tipo = options.tipo || 'aviso';
      const prioridad = options.prioridad || 2;
      const modulo = options.modulo || 'aula';
      const duracionMin = options.duracionMin || 0;
      const activaDesde = options.activaDesde || now;
      let hastaFinal = options.activaHasta || null;
      if (!hastaFinal && duracionMin > 0) hastaFinal = new Date(activaDesde.getTime() + duracionMin * 60000);

      const payload = {
        texto, tipo, prioridad, modulo,
        creadoPor: user.uid, autorEmail: user.email,
        createdAt: fv.serverTimestamp()
      };

      try {
        if (activaDesde instanceof Date) payload.activaDesde = firebase.firestore.Timestamp.fromDate(activaDesde);
        if (hastaFinal instanceof Date) payload.activaHasta = firebase.firestore.Timestamp.fromDate(hastaFinal);
      } catch (_) {}

      await ctx.db.collection(AVISOS).add(payload);
    }

    async function deleteAviso(ctx, id) {
      await ctx.db.collection(AVISOS).doc(id).delete();
    }

    // ══════════════════════════════════════════════════════════
    //  ADMIN DASHBOARD
    // ══════════════════════════════════════════════════════════
    async function getAdminCourseIds(ctx, uid) {
      const snap = await ctx.db.collection(CURS).where('creadoPor', '==', uid).get();
      return snap.docs.map(d => d.id);
    }

    async function getAdminDashboardStats(ctx, uid) {
      const courseIds = await getAdminCourseIds(ctx, uid);
      if (!courseIds.length) return { totalAlumnos: 0, tasaFinalizacion: 0, promedioGeneral: 0 };

      const inscSnap = await ctx.db.collection(INSC).where('cursoId', 'in', courseIds).get();
      const totalAlumnos = inscSnap.size;

      const progSnap = await ctx.db.collection(PROG).where('cursoId', 'in', courseIds).where('progressPct', '==', 100).get();
      const totalCompletados = progSnap.size;

      const intentSnap = await ctx.db.collection(INT).where('cursoId', 'in', courseIds).get();
      let totalScore = 0;
      intentSnap.docs.forEach(d => { totalScore += (d.data().score || 0); });

      return {
        totalAlumnos,
        tasaFinalizacion: totalAlumnos > 0 ? Math.round((totalCompletados / totalAlumnos) * 100) : 0,
        promedioGeneral: intentSnap.size > 0 ? Math.round(totalScore / intentSnap.size) : 0
      };
    }

    async function getAdminActivityFeed(ctx, uid) {
      const courseIds = await getAdminCourseIds(ctx, uid);
      if (!courseIds.length) return [];

      const [inscSnap, intentSnap] = await Promise.all([
        ctx.db.collection(INSC).where('cursoId', 'in', courseIds).orderBy('fechaInscripcion', 'desc').limit(5).get(),
        ctx.db.collection(INT).where('cursoId', 'in', courseIds).orderBy('at', 'desc').limit(5).get()
      ]);

      const feed = [];
      inscSnap.docs.forEach(d => {
        const data = d.data();
        feed.push({
          type: 'insc',
          date: data.fechaInscripcion?.toDate?.() || new Date(),
          text: `<strong>${data.studentEmail}</strong> se inscribio a <strong>${data.cursoTitulo}</strong>.`
        });
      });
      intentSnap.docs.forEach(d => {
        const data = d.data();
        const icon = data.approved ? 'text-success bi-check-circle-fill' : 'text-danger bi-x-circle-fill';
        feed.push({
          type: 'quiz',
          date: data.at?.toDate?.() || new Date(),
          text: `<i class="bi ${icon}"></i> UID ${(data.uid || '').slice(0, 8)}... obtuvo <strong>${data.score}%</strong>.`
        });
      });

      return feed.sort((a, b) => b.date - a.date).slice(0, 10);
    }

    async function generateReportData(ctx, uid, type, cursoId) {
      const courseIds = await getAdminCourseIds(ctx, uid);
      if (!courseIds.length) return [];

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
            Fecha_Inscripcion: insc.fechaInscripcion?.toDate?.()?.toLocaleDateString?.() || '-',
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
              UID: int.uid,
              Curso: cursosMap.get(int.cursoId)?.titulo || int.cursoId,
              Fecha: int.at?.toDate?.()?.toLocaleString?.() || '-',
              Calificacion: int.score,
              Aprobado: int.approved ? 'SI' : 'NO'
            };
          });
      }

      return [];
    }

    // ── API Publica ──
    return {
      getCourse, createCourse, updateCourse, deleteCourse, togglePublished,
      getModules, streamModules, addModule, updateModule, deleteModule,
      streamLessons, getAllLessons, addLesson, updateLesson, deleteLesson,
      streamQuizzes, addQuiz, updateQuiz, deleteQuiz,
      getFirstQuiz, getAttempts, evaluateQuiz, saveAttempt,
      ensureProgress, streamProgress, markLessonComplete, markModuleComplete, updateLastViewed,
      updateStreak,
      enroll, unenroll, getCourseStudents,
      issueCertificate, getCertificate,
      getBadgeDefs, getUserBadges, checkAndAwardBadges,
      streamAvisos, addAviso, deleteAviso,
      getAdminCourseIds, getAdminDashboardStats, getAdminActivityFeed, generateReportData
    };

  })();

  global.AulaService = AulaService;
})(window);
