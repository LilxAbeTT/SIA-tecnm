// functions/index.js
// Cloud Functions de SIA TecNM
// Push notifications via FCM y agregadores de analitica.

const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const TYPE_EMOJI = {
  medi: '🏥',
  biblio: '📚',
  aula: '🎓',
  encuestas: '📋',
  quejas: '💬',
  cafeteria: '☕',
  foro: '🎟️',
  lactario: '💧',
  aviso: '📢',
  recordatorio: '⏰',
  sistema: '⚙️',
  info: 'ℹ️',
};

const APP_URL = 'https://sia-tecnm.web.app';

function resolveNotificationLink(link) {
  if (!link) return APP_URL;
  if (link.startsWith('http')) return link;
  return `${APP_URL}${link.startsWith('/') ? '' : '/'}${link}`;
}

function isInvalidTokenError(err) {
  return err?.code === 'messaging/registration-token-not-registered'
    || err?.code === 'messaging/invalid-registration-token';
}

function buildPushMessage(token, payload) {
  const { notifId, tipo, title, body, link } = payload;
  return {
    token,
    notification: {
      title,
      body,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'sia-general',
        tag: `sia-${tipo}-${notifId}`,
      },
    },
    webpush: {
      notification: {
        title,
        body,
        icon: `${APP_URL}/images/logo-sia.png`,
        badge: `${APP_URL}/assets/icons/badge-96x96.png`,
        requireInteraction: false,
        tag: `sia-${tipo}-${notifId}`,
      },
      fcmOptions: {
        link,
      },
    },
    data: {
      tipo: String(tipo || 'info'),
      notifId: String(notifId || ''),
      link: link || APP_URL,
    },
  };
}

exports.sendPushOnNewNotification = onDocumentCreated(
  'usuarios/{uid}/notificaciones/{notifId}',
  async (event) => {
    const { uid, notifId } = event.params;
    const notifData = event.data?.data();

    if (!notifData) {
      console.log(`[Push] Notificacion ${notifId} vacia, ignorando.`);
      return null;
    }

    if (notifData?.meta?.skipPushTrigger) {
      console.log(`[Push] Notificacion ${notifId} marcada para omitir trigger push.`);
      return null;
    }

    const { titulo, mensaje, tipo = 'info', link } = notifData;
    console.log(`[Push] Nueva notificacion para ${uid}: "${titulo}"`);

    const db = getFirestore();
    let tokenSnap;
    try {
      tokenSnap = await db
        .collection('usuarios').doc(uid)
        .collection('pushTokens')
        .get();
    } catch (err) {
      console.error(`[Push] Error leyendo tokens de ${uid}:`, err);
      return null;
    }

    const tokenEntries = tokenSnap.docs
      .map((doc) => {
        const data = doc.data() || {};
        const fcmToken = String(data.fcmToken || data.token || '').trim();
        if (!fcmToken) return null;
        return {
          id: doc.id,
          ref: doc.ref,
          token: fcmToken,
        };
      })
      .filter(Boolean);

    if (tokenEntries.length === 0) {
      console.log(`[Push] Usuario ${uid} no tiene tokens push registrados.`);
      return null;
    }

    const emoji = TYPE_EMOJI[tipo] || TYPE_EMOJI.info;
    const notifLink = resolveNotificationLink(link);
    const payload = {
      notifId,
      tipo,
      title: `${emoji} ${titulo}`,
      body: mensaje || '',
      link: notifLink,
    };

    const results = await Promise.allSettled(
      tokenEntries.map((entry) => getMessaging().send(buildPushMessage(entry.token, payload)))
    );

    let okCount = 0;
    const invalidRefs = [];

    results.forEach((result, index) => {
      const entry = tokenEntries[index];
      if (result.status === 'fulfilled') {
        okCount++;
        return;
      }

      const err = result.reason;
      if (isInvalidTokenError(err)) {
        console.warn(`[Push] Token invalido para ${uid} (${entry.id}), eliminando...`);
        invalidRefs.push(entry.ref);
      } else {
        console.error(`[Push] Error enviando push a ${uid} (${entry.id}):`, err);
      }
    });

    if (invalidRefs.length > 0) {
      await Promise.all(invalidRefs.map((ref) => ref.delete().catch(() => null)));
    }

    console.log(`[Push] Enviado a ${uid}: ${okCount}/${tokenEntries.length} token(s) OK.`);
    return null;
  }
);

exports.aggregateAvisoViews = onDocumentWritten(
  'usuarios/{uid}/avisoViews/{avisoId}',
  async (event) => {
    const { avisoId } = event.params;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const beforeOpen = Number(before?.openCount || 0);
    const afterOpen = Number(after?.openCount || 0);
    const beforeCompleted = Number(before?.completedCount || 0);
    const afterCompleted = Number(after?.completedCount || 0);
    const deltaOpen = afterOpen - beforeOpen;
    const deltaCompleted = afterCompleted - beforeCompleted;
    const deltaUnique = before ? 0 : (after ? 1 : 0);
    const sourceKey = (after?.lastSource || before?.lastSource || '').trim();

    if (!deltaOpen && !deltaCompleted && !deltaUnique) {
      return null;
    }

    const updates = {
      updatedAt: FieldValue.serverTimestamp()
    };

    if (deltaOpen) {
      updates.viewCount = FieldValue.increment(deltaOpen);
      updates['analytics.totalViews'] = FieldValue.increment(deltaOpen);
    }
    if (deltaCompleted) {
      updates['analytics.completedViews'] = FieldValue.increment(deltaCompleted);
    }
    if (deltaUnique) {
      updates['analytics.uniqueViewers'] = FieldValue.increment(deltaUnique);
    }

    if (deltaOpen && sourceKey) {
      updates[`analytics.viewsBySource.${sourceKey}`] = FieldValue.increment(deltaOpen);
    }

    if (after?.lastSeenAt) {
      updates['analytics.lastViewedAt'] = after.lastSeenAt;
    }

    await getFirestore().collection('avisos').doc(avisoId).update(updates);
    return null;
  }
);

exports.aggregateSurveyResponses = onDocumentCreated(
  'encuestas-respuestas/{responseId}',
  async (event) => {
    const data = event.data?.data();
    if (!data?.surveyId) return null;

    const updates = {
      responseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      'analytics.totalResponses': FieldValue.increment(1),
      'analytics.uniqueRespondents': FieldValue.increment(1)
    };

    if (data.submittedAt) {
      updates['analytics.lastResponseAt'] = data.submittedAt;
    }

    const sourceKey = String(data.source || 'module').trim();
    if (sourceKey) {
      updates[`analytics.responseSources.${sourceKey}`] = FieldValue.increment(1);
    }

    await getFirestore().collection('encuestas').doc(data.surveyId).set(updates, { merge: true });
    return null;
  }
);

exports.aggregateServiceSurveyResponses = onDocumentCreated(
  'encuestas-servicio-respuestas/{responseId}',
  async (event) => {
    const data = event.data?.data();
    if (!data?.serviceType) return null;

    const updates = {
      responseCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      'analytics.totalResponses': FieldValue.increment(1)
    };

    if (data.submittedAt) {
      updates['analytics.lastResponseAt'] = data.submittedAt;
    }

    await getFirestore().collection('encuestas-servicio').doc(data.serviceType).set(updates, { merge: true });
    return null;
  }
);

exports.aggregateServiceSurveyExemptions = onDocumentWritten(
  'encuestas-servicio-triggers/{triggerId}',
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const serviceType = after?.serviceType || before?.serviceType;
    if (!serviceType) return null;

    const beforeExempted = !!before?.exempted;
    const afterExempted = !!after?.exempted;
    if (beforeExempted === afterExempted) return null;

    const delta = afterExempted ? 1 : -1;
    await getFirestore().collection('encuestas-servicio').doc(serviceType).set({
      updatedAt: FieldValue.serverTimestamp(),
      'analytics.notUsedCount': FieldValue.increment(delta)
    }, { merge: true });

    return null;
  }
);

Object.assign(exports, require('./foro'));
Object.assign(exports, require('./panic'));
Object.assign(exports, require('./scanner'));
