// public/services/admin-service.js
// Servicio consolidado del SIA Command Center (Fases 1, 2 y 3)

const AdminService = {
  /** * Fase 1: Obtiene todos los usuarios del sistema para el Directorio Maestro 
   */
  async getAllUsers(ctx) {
    const snap = await ctx.db.collection('usuarios').orderBy('createdAt', 'desc').get();
    return snap.docs;
  },

  /** * Fase 1 + Auditoría Fase 3: Actualiza rol y status de un usuario 
   */
  async updateUserIdentity(ctx, uid, updates) {
    try {
      await ctx.db.collection('usuarios').doc(uid).update({
        ...updates,
        updatedAt: SIA.FieldValue.serverTimestamp(),
        modifiedBy: ctx.currentUserProfile.uid
      });
      
      // 🚨 REGISTRO DE AUDITORÍA (Fase 3)
      if (window.AuditService) {
        await AuditService.logAction(ctx, 'UPDATE_USER_ROLE', { 
          targetUid: uid, 
          newRole: updates.role,
          status: updates.status,
          module: 'idm'
        });
      }
      
      return true;
    } catch (e) {
      console.error("AdminService Error (Identity):", e);
      throw e;
    }
  },

  /** * Fase 2 + Auditoría Fase 3: Crea un aviso que afecta a todo el sistema 
   */
  async createGlobalNotice(ctx, notice) {
    const expiresAt = notice.duration > 0 
      ? new Date(Date.now() + notice.duration * 60000) 
      : null;

    const noticeData = {
      texto: notice.texto,
      tipo: notice.tipo,
      modulo: 'global',
      prioridad: notice.tipo === 'emergencia' ? 1 : 2,
      createdAt: SIA.FieldValue.serverTimestamp(),
      activaDesde: SIA.FieldValue.serverTimestamp(),
      activaHasta: expiresAt ? firebase.firestore.Timestamp.fromDate(expiresAt) : null,
      createdBy: ctx.currentUserProfile.uid
    };

    try {
      const res = await ctx.db.collection('avisos').add(noticeData);
      
      // 🚨 REGISTRO DE AUDITORÍA (Fase 3)
      if (window.AuditService) {
        await AuditService.logAction(ctx, 'CREATE_GLOBAL_NOTICE', { 
          noticeId: res.id, 
          type: notice.tipo,
          module: 'system'
        });
      }
      
      return res;
    } catch (e) {
      console.error("AdminService Error (Notice):", e);
      throw e;
    }
  },

  /** * Fase 2: Guarda configuraciones globales de módulos (Kill Switches, Slots, etc.)
   */
  async setGlobalConfig(ctx, path, data) {
    try {
      await ctx.db.collection('config').doc(path).set({
        ...data,
        updatedAt: SIA.FieldValue.serverTimestamp(),
        updatedBy: ctx.currentUserProfile.uid
      }, { merge: true });

      // Opcional: Log de cambio de configuración
      if (window.AuditService) {
        await AuditService.logAction(ctx, 'UPDATE_CONFIG', { path, module: 'system' });
      }
      
      return true;
    } catch (e) {
      console.error("AdminService Error (Config):", e);
      throw e;
    }
  },

  /** * Fase 2: Stream de avisos en tiempo real para la tabla de gestión administrativa
   */
  streamGlobalNotices(ctx, callback) {
    return ctx.db.collection('avisos')
      .where('modulo', '==', 'global')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .onSnapshot(callback);
  },

  /**
   * Fase 2: Eliminar avisos (útil para limpiar el sistema)
   */
  async deleteNotice(ctx, noticeId) {
    try {
      await ctx.db.collection('avisos').doc(noticeId).delete();
      if (window.AuditService) {
        await AuditService.logAction(ctx, 'DELETE_NOTICE', { noticeId, module: 'system' });
      }
      return true;
    } catch (e) {
      console.error("AdminService Error (DeleteNotice):", e);
      throw e;
    }
  }
};

// Exportación global para los módulos admin.*.js
window.AdminService = AdminService;