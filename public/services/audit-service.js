// public/services/audit-service.js
const AuditService = {
  /** Registra una acción administrativa en la bitácora */
  async logAction(ctx, action, details = {}) {
    try {
      await ctx.db.collection('system-logs').add({
        adminId: ctx.currentUserProfile.uid,
        adminName: ctx.currentUserProfile.displayName || ctx.currentUserProfile.email,
        action: action,
        details: details,
        timestamp: SIA.FieldValue.serverTimestamp(),
        module: details.module || 'system'
      });
    } catch (e) {
      console.warn("[Audit] Error al registrar log:", e);
    }
  },

  /** Obtiene los últimos logs de auditoría */
  async getRecentLogs(ctx, limit = 100) {
    const snap = await ctx.db.collection('system-logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snap.docs;
  },

  /** Consulta data agregada para reportes y gráficas */
  async getSystemStats(ctx) {
    // Ejemplo de agregación simple para la distribución de usuarios
    const usersSnap = await ctx.db.collection('usuarios').get();
    const distribution = { student: 0, medico: 0, biblio: 0, aula: 0, docente: 0, superadmin: 0 };
    
    usersSnap.forEach(doc => {
      const role = doc.data().role || 'student';
      if (distribution[role] !== undefined) distribution[role]++;
    });
    
    return {
      totalUsers: usersSnap.size,
      roleDistribution: distribution
    };
  }
};
window.AuditService = AuditService;