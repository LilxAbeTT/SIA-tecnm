// services/notify.js
// Servicio central de notificaciones In-App (Firestore)

(function(global){
  
  const Notify = {
    
    /**
     * Envia una notificación a un usuario específico.
     * @param {string} uid - ID del usuario destino.
     * @param {object} data - { title, message, type, link }
     * type: 'medi' | 'biblio' | 'aula' | 'system' | 'info'
     */
    async send(uid, { title, message, type = 'system', link = null }) {
      if (!uid) return;
      
      try {
        // Referencia a la sub-colección 'notificaciones' del usuario
        await SIA.db.collection('usuarios').doc(uid).collection('notificaciones').add({
          titulo: title,
          mensaje: message,
          tipo: type,
          link: link,
          leido: false,
          createdAt: SIA.FieldValue.serverTimestamp()
        });
        console.log(`[Notify] Enviado a ${uid}: ${title}`);
      } catch (e) {
        console.error('[Notify] Error enviando notificación:', e);
      }
    },

    /**
     * Escucha las notificaciones de un usuario en tiempo real.
     * @param {string} uid - ID del usuario.
     * @param {function} callback - Función que recibe el array de notificaciones.
     * @returns {function} - Función para desuscribirse (unsubscribe).
     */
    /**
     * Escucha las notificaciones (VERSIÓN CORREGIDA: Ordenamiento en cliente)
     */
    /**
     * Escucha las notificaciones (VERSIÓN "FUERZA BRUTA": Sin límites ni orden)
     */
    stream(uid, callback) {
      if (!uid) return () => {};

      console.log("[Notify] Suscribiendo a notificaciones (Raw)...");

      // Quitamos .limit(20) y .orderBy(). Traemos la colección cruda.
      return SIA.db.collection('usuarios').doc(uid).collection('notificaciones')
        .onSnapshot(snapshot => {
          console.log("[Notify] ¡SNAPSHOT RECIBIDO!", snapshot.size, "docs");
          
          const notifs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Ordenamos en memoria (Cliente)
          notifs.sort((a, b) => {
             const dateA = a.createdAt ? a.createdAt.toDate() : new Date();
             const dateB = b.createdAt ? b.createdAt.toDate() : new Date();
             return dateB - dateA; 
          });
          
          const unreadCount = notifs.filter(n => !n.leido).length;
          callback(notifs, unreadCount);

        }, error => {
          console.error('[Notify] ❌ Error CRÍTICO en stream:', error);
        });
    },

    /**
     * Marca una notificación específica como leída.
     */
    async markAsRead(uid, notifId) {
      if (!uid || !notifId) return;
      try {
        await SIA.db.collection('usuarios').doc(uid)
          .collection('notificaciones').doc(notifId)
          .update({ leido: true });
      } catch (e) {
        console.error('[Notify] Error marcando leída:', e);
      }
    },

    /**
     * Marca TODAS las notificaciones visibles como leídas.
     * (Útil al abrir el panel de notificaciones)
     */
    async markAllAsRead(uid, notifIds = []) {
      if (!uid || !notifIds.length) return;
      
      const batch = SIA.db.batch();
      const colRef = SIA.db.collection('usuarios').doc(uid).collection('notificaciones');

      notifIds.forEach(id => {
        const docRef = colRef.doc(id);
        batch.update(docRef, { leido: true });
      });

      try {
        await batch.commit();
      } catch (e) {
        console.error('[Notify] Error en batch markAllAsRead:', e);
      }
    },

    // Mantenemos stub de email por si se requiere en el futuro
    async sendEmail({to, subject, html}){
      console.log('[Notify.sendEmail] (Simulado) ->', to, subject);
    }
  };

  global.Notify = Notify;

})(window);