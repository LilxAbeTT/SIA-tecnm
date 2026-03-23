/* ============================================================
   Aula Orchestrator — Modulo enrutador principal para Aula
   ============================================================ */
(function (global) {
  const AulaModule = (function () {
    let _lastInitKey = '';
    let _lastInitTs = 0;

    async function init(ctx) {
      if (!ctx?.profile) return;

      const hash = window.location.hash.slice(1);
      const initKey = `${ctx.auth?.currentUser?.uid || ctx.profile?.uid || 'anon'}|${hash}`;
      const now = Date.now();
      if (_lastInitKey === initKey && now - _lastInitTs < 250) return;
      _lastInitKey = initKey;
      _lastInitTs = now;

      // Soporta deep-link: /aula/clase/{claseId} y /aula/clase/{claseId}/pub/{pubId}
      const claseMatch = hash.match(/^\/aula\/clase\/([^/]+)(?:\/pub\/([^/]+))?/);
      if (claseMatch?.[1]) {
        const autoOpenPubId = claseMatch[2] || null;
        // Delegar a modulo AulaClase
        if (global.AulaClase?.init) await global.AulaClase.init(ctx, claseMatch[1], autoOpenPubId);
        else console.error('[Aula] AulaClase module not loaded');
        return;
      }

      // Render principal dependiendo del rol
      const isDocente = global.SIA?.canTeachInAula
        ? global.SIA.canTeachInAula(ctx.profile)
        : (
            ['docente', 'aula_admin', 'admin', 'aula', 'superadmin'].includes(ctx.profile?.role || 'student') ||
            ctx.profile?.permissions?.aula === 'admin' ||
            ctx.profile?.permissions?.aula === 'docente'
          );

      if (isDocente) {
        if (global.AdminAula?.init) await global.AdminAula.init(ctx);
        else console.error('[Aula] AdminAula module not loaded');
      } else {
        if (global.AulaStudent?.init) await global.AulaStudent.init(ctx);
        else console.error('[Aula] AulaStudent module not loaded');
      }
    }

    function navigateBack() { window.location.hash = '/aula'; }

    function initStudent(ctx) { return init(ctx); }
    function initAdmin(ctx) { return init(ctx); }
    function initSuperAdmin(ctx) { return init(ctx); }

    return { init, initStudent, initAdmin, initSuperAdmin, navigateBack };
  })();

  global.Aula = AulaModule;
})(window);
