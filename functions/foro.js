const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const C_EVENTS = 'foro_events';
const C_TICKETS = 'foro_tickets';
const C_CONVERSATIONS = 'foro_conversations';
const C_MESSAGES = 'messages';
const REGION = 'us-central1';
const QR_TTL_MINUTES = 1;
const REMINDER_WINDOWS = [
  { key: '24h', minutes: 24 * 60, toleranceMinutes: 8 },
  { key: '1h', minutes: 60, toleranceMinutes: 8 },
  { key: '15m', minutes: 15, toleranceMinutes: 8 }
];
const VALID_TYPES = new Set(['conferencia', 'exposicion', 'otro']);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeArray(values) {
  return Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : [];
}

function safeUrl(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return '';
}

function parseDateInput(value, fieldName) {
  if (!value) {
    throw new HttpsError('invalid-argument', `Falta ${fieldName}.`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError('invalid-argument', `${fieldName} no tiene un formato valido.`);
  }
  return date;
}

function toTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value?.toDate === 'function') return Timestamp.fromDate(value.toDate());
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildTicketId(eventId, uid) {
  return `${eventId}__${uid}`;
}

function buildConversationId(eventId, uid) {
  return `${eventId}__${uid}`;
}

function createSecret() {
  return crypto.randomBytes(18).toString('hex');
}

function buildQrToken(eventId, kind, bucket, secret) {
  return crypto
    .createHash('sha256')
    .update(`${eventId}:${kind}:${bucket}:${secret}`)
    .digest('hex')
    .slice(0, 20);
}

function getQrBucket(date = new Date()) {
  return Math.floor(date.getTime() / (QR_TTL_MINUTES * 60 * 1000));
}

function buildQrPayload(eventId, kind, secret, date = new Date()) {
  const bucket = getQrBucket(date);
  const token = buildQrToken(eventId, kind, bucket, secret);
  const prefix = kind === 'attendance' ? 'FORO_EVENT' : 'FORO_RES';
  const expiresAt = new Date((bucket + 1) * QR_TTL_MINUTES * 60 * 1000);
  return {
    qrData: `SIA:${prefix}:${eventId}:${bucket}:${token}`,
    refreshMs: QR_TTL_MINUTES * 60 * 1000,
    expiresAt: expiresAt.toISOString()
  };
}

function verifyQrPayload(qrData, kind, eventId, secret) {
  const prefix = kind === 'attendance' ? 'FORO_EVENT' : 'FORO_RES';
  const parts = normalizeText(qrData).split(':');
  if (parts.length !== 5 || parts[0] !== 'SIA' || parts[1] !== prefix) {
    throw new HttpsError('invalid-argument', 'El codigo QR no corresponde al evento esperado.');
  }
  if (parts[2] !== eventId) {
    throw new HttpsError('permission-denied', 'El QR pertenece a otro evento.');
  }
  const bucket = Number(parts[3]);
  const token = parts[4];
  if (!Number.isFinite(bucket) || !token) {
    throw new HttpsError('invalid-argument', 'El codigo QR es invalido.');
  }

  const currentBucket = getQrBucket();
  for (let offset = -1; offset <= 1; offset += 1) {
    const candidate = currentBucket + offset;
    if (candidate === bucket && buildQrToken(eventId, kind, bucket, secret) === token) {
      return true;
    }
  }
  throw new HttpsError('failed-precondition', 'El QR ya expiro. Solicita uno actualizado.');
}

function getCareer(profile) {
  return normalizeText(profile?.career || profile?.carrera || 'GENERIC') || 'GENERIC';
}

function getDisplayName(profile) {
  return normalizeText(profile?.displayName || profile?.nombre || profile?.emailInstitucional || profile?.email || 'Usuario');
}

function getEmail(profile) {
  return normalizeKey(profile?.emailInstitucional || profile?.email || '');
}

function getForoAccess(profile) {
  const role = normalizeKey(profile?.role);
  const foroPermission = normalizeKey(profile?.permissions?.foro);
  const email = getEmail(profile);
  const isSuperAdmin = role === 'superadmin';
  const isDifusion = isSuperAdmin || role === 'foro' || foroPermission === 'superadmin' || email === 'difusion@loscabos.tecnm.mx';
  const canManageEvents = isDifusion || role === 'foro_admin' || foroPermission === 'admin' || foroPermission === 'superadmin';
  return {
    isSuperAdmin,
    isDifusion,
    canManageEvents,
    isDivisionHead: canManageEvents && !isDifusion
  };
}

async function getUserProfile(uid) {
  const db = getFirestore();
  const snap = await db.collection('usuarios').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'No se encontro el perfil del usuario.');
  }
  return { id: snap.id, ...snap.data() };
}

async function requireUserContext(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
  }
  const profile = await getUserProfile(uid);
  return { uid, profile, access: getForoAccess(profile) };
}

async function getEventOrThrow(eventId) {
  const db = getFirestore();
  const ref = db.collection(C_EVENTS).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'El evento no existe.');
  }
  return { ref, snap, data: snap.data() };
}

function buildTicketEventSnapshot(eventData) {
  return {
    eventTitle: normalizeText(eventData?.title || 'Evento'),
    eventLocation: normalizeText(eventData?.location || ''),
    eventDate: toTimestamp(eventData?.date),
    eventEndDate: toTimestamp(eventData?.endDate),
    eventType: normalizeText(eventData?.type || 'otro') || 'otro',
    eventRoom: normalizeText(eventData?.room || ''),
    eventMapUrl: safeUrl(eventData?.mapUrl),
    eventDayInstructions: normalizeText(eventData?.dayInstructions || ''),
    organizerId: normalizeText(eventData?.createdBy || ''),
    organizerName: normalizeText(eventData?.createdByName || ''),
    contactEnabled: eventData?.contactEnabled != false,
    allowSelfCheckIn: eventData?.allowSelfCheckIn != false,
    hasResources: eventData?.hasResources == true,
    resourcesCount: Number(eventData?.resourcesCount || 0),
    eventStatus: normalizeKey(eventData?.status) || 'pending'
  };
}

function buildTicketSyncPatch(ticketData, eventData) {
  const patch = {
    ...buildTicketEventSnapshot(eventData),
    updatedAt: FieldValue.serverTimestamp()
  };

  const previousEventDate = toDate(ticketData?.eventDate)?.getTime() || null;
  const nextEventDate = toDate(eventData?.date)?.getTime() || null;
  if (normalizeKey(ticketData?.status) === 'registered' && previousEventDate !== nextEventDate) {
    patch.remindersSent = {};
  }

  if (normalizeKey(eventData?.status) === 'cancelled') {
    patch.eventCancelledAt = Timestamp.now();
  } else if (ticketData?.eventCancelledAt) {
    patch.eventCancelledAt = FieldValue.delete();
  }

  return patch;
}

async function syncEventSnapshotToTickets(eventId, eventData) {
  const db = getFirestore();
  const snap = await db.collection(C_TICKETS)
    .where('eventId', '==', eventId)
    .get();
  if (snap.empty) return 0;

  let batch = db.batch();
  let writes = 0;
  let synced = 0;

  for (const doc of snap.docs) {
    batch.set(doc.ref, buildTicketSyncPatch(doc.data(), eventData), { merge: true });
    writes += 1;
    synced += 1;

    if (writes >= 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }

  if (writes) {
    await batch.commit();
  }

  return synced;
}

async function getPrivateDoc(eventId, docId) {
  const db = getFirestore();
  return db.collection(C_EVENTS).doc(eventId).collection('private').doc(docId).get();
}

function summarizeResources(items, qrEnabled) {
  const count = Array.isArray(items) ? items.length : 0;
  return {
    hasResources: count > 0,
    resourcesCount: count,
    resourcesQrEnabled: count > 0 && !!qrEnabled
  };
}

function sanitizeResourceItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const type = normalizeKey(item?.type) === 'file' ? 'file' : 'link';
      const title = normalizeText(item?.title || item?.name || `${type === 'file' ? 'Archivo' : 'Enlace'} ${index + 1}`).slice(0, 120);
      const description = normalizeText(item?.description).slice(0, 280);
      const url = safeUrl(item?.url);
      if (!url) return null;
      return {
        id: normalizeText(item?.id || `${Date.now()}_${index}`),
        type,
        title,
        description,
        url,
        fileName: normalizeText(item?.fileName || ''),
        mimeType: normalizeText(item?.mimeType || '')
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeEventInput(data) {
  const title = normalizeText(data?.title).slice(0, 160);
  const speaker = normalizeText(data?.speaker).slice(0, 120);
  const location = normalizeText(data?.location).slice(0, 160);
  const description = normalizeText(data?.description).slice(0, 2200);
  const room = normalizeText(data?.room).slice(0, 120);
  const dayInstructions = normalizeText(data?.dayInstructions).slice(0, 1200);
  const mapUrl = safeUrl(data?.mapUrl);
  const coverImage = safeUrl(data?.coverImage);
  const type = VALID_TYPES.has(normalizeKey(data?.type)) ? normalizeKey(data?.type) : 'otro';
  const capacity = Math.min(5000, Math.max(1, Number(data?.capacity) || 100));
  const audience = normalizeArray(data?.targetAudience);
  const date = parseDateInput(data?.date, 'la fecha de inicio');
  const endDate = data?.endDate ? parseDateInput(data.endDate, 'la fecha de fin') : new Date(date.getTime() + 90 * 60 * 1000);
  if (endDate <= date) {
    throw new HttpsError('invalid-argument', 'La fecha de fin debe ser posterior a la fecha de inicio.');
  }

  const attendanceOpensMinutesBefore = Math.min(180, Math.max(0, Number(data?.attendanceOpensMinutesBefore) || 30));
  const attendanceClosesMinutesAfter = Math.min(360, Math.max(15, Number(data?.attendanceClosesMinutesAfter) || 120));
  const contactEnabled = data?.contactEnabled !== false;
  const allowSelfCheckIn = data?.allowSelfCheckIn !== false;

  const resources = sanitizeResourceItems(data?.resources);
  const resourcesQrEnabled = data?.resourcesQrEnabled !== false;
  const summary = summarizeResources(resources, resourcesQrEnabled);

  if (!title) throw new HttpsError('invalid-argument', 'El titulo es obligatorio.');
  if (!speaker) throw new HttpsError('invalid-argument', 'El responsable o ponente es obligatorio.');
  if (!location) throw new HttpsError('invalid-argument', 'La ubicacion es obligatoria.');

  return {
    eventData: {
      title,
      speaker,
      location,
      description,
      room,
      mapUrl,
      dayInstructions,
      coverImage,
      type,
      capacity,
      targetAudience: audience.length ? audience : ['ALL'],
      date: Timestamp.fromDate(date),
      endDate: Timestamp.fromDate(endDate),
      attendanceOpensMinutesBefore,
      attendanceClosesMinutesAfter,
      contactEnabled,
      allowSelfCheckIn,
      updatedAt: FieldValue.serverTimestamp(),
      ...summary
    },
    resources,
    resourcesQrEnabled
  };
}

function getCheckInWindow(eventData) {
  const start = toDate(eventData?.date);
  const end = toDate(eventData?.endDate) || new Date(start.getTime() + 90 * 60 * 1000);
  const opensMinutesBefore = Math.max(0, Number(eventData?.attendanceOpensMinutesBefore) || 30);
  const closesMinutesAfter = Math.max(15, Number(eventData?.attendanceClosesMinutesAfter) || 120);
  const openAt = new Date(start.getTime() - opensMinutesBefore * 60 * 1000);
  const closeBase = end > start ? end : start;
  const closeAt = new Date(closeBase.getTime() + closesMinutesAfter * 60 * 1000);
  return { start, end, openAt, closeAt };
}

function assertCheckInAllowed(eventData) {
  if (normalizeKey(eventData?.status) !== 'active') {
    throw new HttpsError('failed-precondition', 'El evento no esta disponible para registrar asistencia.');
  }
  const now = new Date();
  const { openAt, closeAt } = getCheckInWindow(eventData);
  if (now < openAt) {
    throw new HttpsError('failed-precondition', 'La asistencia todavia no esta abierta para este evento.');
  }
  if (now > closeAt) {
    throw new HttpsError('failed-precondition', 'La ventana de asistencia ya cerro para este evento.');
  }
}

function isAudienceAllowed(eventData, career) {
  const audience = Array.isArray(eventData?.targetAudience) ? eventData.targetAudience : [];
  if (!audience.length || audience.includes('ALL')) return true;
  return audience.includes(career);
}

async function findUserTicket(eventId, uid) {
  const db = getFirestore();
  const directRef = db.collection(C_TICKETS).doc(buildTicketId(eventId, uid));
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    return { ref: directRef, snap: directSnap, data: directSnap.data() };
  }

  const snap = await db.collection(C_TICKETS)
    .where('eventId', '==', eventId)
    .where('userId', '==', uid)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, snap: snap.docs[0], data: snap.docs[0].data() };
}

async function requireEventManager(uid, eventId) {
  const profile = await getUserProfile(uid);
  const access = getForoAccess(profile);
  if (!access.canManageEvents) {
    throw new HttpsError('permission-denied', 'No tienes permisos de administracion para Eventos.');
  }
  const eventRecord = await getEventOrThrow(eventId);
  if (!access.isDifusion && eventRecord.data.createdBy !== uid) {
    throw new HttpsError('permission-denied', 'Solo puedes administrar tus propios eventos.');
  }
  return { profile, access, eventRecord };
}

async function saveResourcesForEvent(eventId, resources, qrEnabled, actorName) {
  const db = getFirestore();
  const docRef = db.collection(C_EVENTS).doc(eventId).collection('private').doc('resources');
  if (!resources.length) {
    await docRef.delete().catch(() => null);
    return;
  }
  await docRef.set({
    items: resources,
    qrEnabled: !!qrEnabled,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorName
  }, { merge: true });
}

async function ensurePrivateRuntime(eventId) {
  const db = getFirestore();
  const ref = db.collection(C_EVENTS).doc(eventId).collection('private').doc('runtime');
  const snap = await ref.get();
  if (snap.exists) return snap.data();
  const runtime = {
    attendanceSecret: createSecret(),
    resourcesSecret: createSecret(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.set(runtime, { merge: true });
  const created = await ref.get();
  return created.data();
}

async function sendNotification(uid, data) {
  if (!uid) return;
  const db = getFirestore();
  await db.collection('usuarios').doc(uid).collection('notificaciones').add({
    titulo: normalizeText(data?.titulo || data?.title || 'Eventos'),
    mensaje: normalizeText(data?.mensaje || data?.message || ''),
    tipo: normalizeText(data?.tipo || data?.type || 'foro') || 'foro',
    link: normalizeText(data?.link || '/foro') || '/foro',
    urgente: !!data?.urgente,
    leido: false,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function notifyEventStatusChange(eventData, action, reason) {
  const targetUid = eventData?.createdBy;
  if (!targetUid) return;
  const title = eventData?.title || 'Evento';
  if (action === 'approve') {
    await sendNotification(targetUid, {
      titulo: 'Evento aprobado',
      mensaje: `"${title}" ya fue publicado para los estudiantes.`,
      tipo: 'foro',
      link: '/foro'
    });
    return;
  }
  await sendNotification(targetUid, {
    titulo: 'Evento rechazado',
    mensaje: reason ? `"${title}" fue rechazado. Motivo: ${reason}` : `"${title}" fue rechazado.`,
    tipo: 'foro',
    link: '/foro',
    urgente: true
  });
}

async function notifyEventCancellation(eventId, eventData) {
  const db = getFirestore();
  const snap = await db.collection(C_TICKETS)
    .where('eventId', '==', eventId)
    .get();
  if (snap.empty) return;
  const uniqueUsers = Array.from(new Set(
    snap.docs
      .map((doc) => doc.data())
      .filter((ticket) => ['registered', 'attended'].includes(ticket.status))
      .map((ticket) => ticket.userId)
      .filter(Boolean)
  ));

  for (let index = 0; index < uniqueUsers.length; index += 50) {
    const chunk = uniqueUsers.slice(index, index + 50);
    await Promise.all(chunk.map((uid) => sendNotification(uid, {
      titulo: 'Evento cancelado',
      mensaje: `"${eventData?.title || 'El evento'}" fue cancelado. Revisa Eventos para conocer novedades.`,
      tipo: 'foro',
      link: '/foro',
      urgente: true
    })));
  }
}

async function notifyAttendanceRecorded(ticketData, eventData) {
  if (!ticketData?.userId) return;
  const hasResources = eventData?.hasResources === true || ticketData?.hasResources === true;
  await sendNotification(ticketData.userId, {
    titulo: 'Asistencia registrada',
    mensaje: hasResources
      ? `"${ticketData.eventTitle || eventData?.title || 'Tu evento'}" ya quedo marcado. Revisa tus recursos en Eventos.`
      : `"${ticketData.eventTitle || eventData?.title || 'Tu evento'}" ya quedo marcado en tu historial.`,
    tipo: 'foro',
    link: '/foro'
  });
}

exports.foroUpsertEvent = onCall({ region: REGION }, async (request) => {
  const { uid, profile, access } = await requireUserContext(request);
  if (!access.canManageEvents) {
    throw new HttpsError('permission-denied', 'No tienes permisos para crear o editar eventos.');
  }

  const eventId = normalizeText(request.data?.eventId);
  const isEdit = !!eventId;
  const { eventData, resources, resourcesQrEnabled } = sanitizeEventInput(request.data || {});
  const db = getFirestore();
  const actorName = getDisplayName(profile);

  if (!isEdit) {
    const initialStatus = access.isDifusion ? 'active' : 'pending';
    const ref = db.collection(C_EVENTS).doc();
    await ref.set({
      ...eventData,
      status: initialStatus,
      registeredCount: 0,
      createdBy: uid,
      createdByName: actorName,
      createdByEmail: normalizeText(profile.emailInstitucional || profile.email || ''),
      division: normalizeText(profile.department || profile.departmentConfig?.department || profile.departmentConfig?.label || 'general'),
      createdAt: FieldValue.serverTimestamp(),
      lastSubmittedAt: FieldValue.serverTimestamp(),
      lastSubmittedBy: actorName
    });
    await ensurePrivateRuntime(ref.id);
    await saveResourcesForEvent(ref.id, resources, resourcesQrEnabled, actorName);
    return {
      eventId: ref.id,
      status: initialStatus,
      message: access.isDifusion
        ? 'Evento creado y publicado.'
        : 'Evento creado y enviado a revision.'
    };
  }

  const eventRecord = await getEventOrThrow(eventId);
  const existing = eventRecord.data;
  if (!access.isDifusion && existing.createdBy !== uid) {
    throw new HttpsError('permission-denied', 'Solo puedes editar tus propios eventos.');
  }

  const nextStatus = access.isDifusion
    ? (normalizeKey(request.data?.status) || normalizeKey(existing.status) || 'active')
    : 'pending';
  const updatePayload = {
    ...eventData,
    status: nextStatus,
    lastSubmittedAt: FieldValue.serverTimestamp(),
    lastSubmittedBy: actorName
  };

  if (!access.isDifusion) {
    updatePayload.validatedAt = null;
    updatePayload.validatedBy = null;
    updatePayload.rejectedAt = null;
    updatePayload.rejectedBy = null;
    updatePayload.rejectionReason = null;
  }

  await eventRecord.ref.update(updatePayload);
  await ensurePrivateRuntime(eventId);
  await saveResourcesForEvent(eventId, resources, resourcesQrEnabled, actorName);
  await syncEventSnapshotToTickets(eventId, {
    ...existing,
    ...eventData,
    status: nextStatus,
    createdBy: existing.createdBy,
    createdByName: existing.createdByName
  });

  return {
    eventId,
    status: nextStatus,
    message: access.isDifusion
      ? 'Evento actualizado correctamente.'
      : (normalizeKey(existing.status) === 'active'
        ? 'Evento actualizado y reenviado a revision.'
        : 'Evento actualizado correctamente.')
  };
});

exports.foroReviewEvent = onCall({ region: REGION }, async (request) => {
  const { profile, access } = await requireUserContext(request);
  if (!access.isDifusion) {
    throw new HttpsError('permission-denied', 'Solo Difusion puede aprobar o rechazar eventos.');
  }

  const eventId = normalizeText(request.data?.eventId);
  const action = normalizeKey(request.data?.action);
  const reason = normalizeText(request.data?.reason).slice(0, 500);
  if (!eventId || !['approve', 'reject'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Solicitud de revision invalida.');
  }

  const eventRecord = await getEventOrThrow(eventId);
  const updates = {
    updatedAt: FieldValue.serverTimestamp()
  };

  if (action === 'approve') {
    updates.status = 'active';
    updates.validatedBy = getDisplayName(profile);
    updates.validatedAt = FieldValue.serverTimestamp();
    updates.rejectionReason = null;
    updates.rejectedAt = null;
    updates.rejectedBy = null;
  } else {
    if (!reason) {
      throw new HttpsError('invalid-argument', 'Debes indicar el motivo del rechazo.');
    }
    updates.status = 'rejected';
    updates.rejectedBy = getDisplayName(profile);
    updates.rejectedAt = FieldValue.serverTimestamp();
    updates.rejectionReason = reason;
  }

  await eventRecord.ref.update(updates);
  await syncEventSnapshotToTickets(eventId, {
    ...eventRecord.data,
    ...updates,
    status: updates.status
  });
  await notifyEventStatusChange(eventRecord.data, action, reason);
  return {
    ok: true,
    status: updates.status
  };
});

exports.foroCancelEvent = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireUserContext(request);
  const eventId = normalizeText(request.data?.eventId);
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'Falta el evento.');
  }

  const { eventRecord } = await requireEventManager(uid, eventId);
  await eventRecord.ref.update({
    status: 'cancelled',
    updatedAt: FieldValue.serverTimestamp(),
    cancelledAt: FieldValue.serverTimestamp(),
    cancelledBy: uid
  });
  await syncEventSnapshotToTickets(eventId, {
    ...eventRecord.data,
    status: 'cancelled'
  });
  await notifyEventCancellation(eventId, eventRecord.data);
  return { ok: true };
});

exports.foroRegister = onCall({ region: REGION }, async (request) => {
  const { uid, profile, access } = await requireUserContext(request);
  if (access.canManageEvents) {
    throw new HttpsError('permission-denied', 'Los administradores no usan el flujo de inscripcion de estudiante.');
  }

  const eventId = normalizeText(request.data?.eventId);
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'Falta el evento.');
  }

  const eventRecord = await getEventOrThrow(eventId);
  const eventData = eventRecord.data;
  if (normalizeKey(eventData.status) !== 'active') {
    throw new HttpsError('failed-precondition', 'El evento no esta disponible para inscripcion.');
  }
  if (!isAudienceAllowed(eventData, getCareer(profile))) {
    throw new HttpsError('permission-denied', 'Este evento no esta dirigido a tu perfil academico.');
  }

  const startDate = toDate(eventData.date);
  if (startDate && startDate <= new Date()) {
    throw new HttpsError('failed-precondition', 'Ya no es posible inscribirse a este evento.');
  }

  const existingTicket = await findUserTicket(eventId, uid);
  if (existingTicket && ['registered', 'attended'].includes(existingTicket.data.status)) {
    throw new HttpsError('already-exists', 'Ya estas inscrito a este evento.');
  }

  const db = getFirestore();
  const ticketRef = db.collection(C_TICKETS).doc(buildTicketId(eventId, uid));
  await db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRecord.ref);
    const liveEvent = eventSnap.data() || {};
    const liveTicketSnap = await transaction.get(ticketRef);
    if (liveTicketSnap.exists) {
      const liveTicket = liveTicketSnap.data() || {};
      if (['registered', 'attended'].includes(normalizeKey(liveTicket.status))) {
        throw new HttpsError('already-exists', 'Ya estas inscrito a este evento.');
      }
    }
    if ((liveEvent.registeredCount || 0) >= (liveEvent.capacity || 0)) {
      throw new HttpsError('failed-precondition', 'El evento ya no tiene lugares disponibles.');
    }

    transaction.set(ticketRef, {
      eventId,
      ...buildTicketEventSnapshot({ ...liveEvent, status: 'active' }),
      userId: uid,
      userName: getDisplayName(profile),
      userMatricula: normalizeText(profile.matricula || ''),
      userCareer: getCareer(profile),
      qrCodeData: `SIA:FORO:${eventId}:${uid}`,
      status: 'registered',
      feedbackSubmitted: false,
      remindersSent: {},
      registeredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.update(eventRecord.ref, {
      registeredCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  await sendNotification(uid, {
    titulo: 'Inscripcion confirmada',
    mensaje: `Tu pase para "${eventData.title || 'el evento'}" ya esta disponible en Mi agenda.`,
    tipo: 'foro',
    link: '/foro'
  });

  return { ok: true, ticketId: ticketRef.id };
});

exports.foroCancelRegistration = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireUserContext(request);
  const ticketId = normalizeText(request.data?.ticketId);
  if (!ticketId) {
    throw new HttpsError('invalid-argument', 'Falta el ticket.');
  }

  const db = getFirestore();
  const ticketRef = db.collection(C_TICKETS).doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) {
    throw new HttpsError('not-found', 'El ticket no existe.');
  }

  const ticket = ticketSnap.data();
  if (ticket.userId !== uid) {
    throw new HttpsError('permission-denied', 'Solo puedes cancelar tus propios tickets.');
  }
  if (ticket.status === 'attended') {
    throw new HttpsError('failed-precondition', 'No puedes cancelar un evento al que ya asististe.');
  }

  const eventRecord = await getEventOrThrow(ticket.eventId);
  const eventStart = toDate(ticket.eventDate || eventRecord.data.date);
  if (eventStart && eventStart <= new Date()) {
    throw new HttpsError('failed-precondition', 'Ya no es posible cancelar esta inscripcion.');
  }

  await db.runTransaction(async (transaction) => {
    const liveTicket = await transaction.get(ticketRef);
    const liveEvent = await transaction.get(eventRecord.ref);
    if (!liveTicket.exists || !liveEvent.exists) {
      throw new HttpsError('not-found', 'No fue posible completar la cancelacion.');
    }
    const ticketData = liveTicket.data();
    if (ticketData.status === 'cancelled') return;

    transaction.update(ticketRef, {
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.update(eventRecord.ref, {
      registeredCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

async function resolveTicketForAttendance(eventId, userId) {
  const ticket = await findUserTicket(eventId, userId);
  if (!ticket) {
    throw new HttpsError('not-found', 'No existe una inscripcion valida para este evento.');
  }
  if (ticket.data.status === 'attended') {
    throw new HttpsError('already-exists', 'La asistencia ya fue registrada.');
  }
  if (ticket.data.status !== 'registered') {
    throw new HttpsError('failed-precondition', 'El ticket no esta disponible para asistencia.');
  }
  return ticket;
}

exports.foroMarkAttendance = onCall({ region: REGION }, async (request) => {
  const { uid, access } = await requireUserContext(request);
  const qrData = normalizeText(request.data?.qrData);
  if (!qrData) {
    throw new HttpsError('invalid-argument', 'Falta el QR.');
  }

  const parts = qrData.split(':');
  if (parts.length !== 4 || parts[0] !== 'SIA' || parts[1] !== 'FORO') {
    throw new HttpsError('invalid-argument', 'El QR del alumno no es valido.');
  }

  const eventId = parts[2];
  const studentId = parts[3];
  const { eventRecord } = await requireEventManager(uid, eventId);
  if (!access.isDifusion && eventRecord.data.createdBy !== uid) {
    throw new HttpsError('permission-denied', 'Solo puedes registrar asistencia en tus propios eventos.');
  }

  assertCheckInAllowed(eventRecord.data);
  const ticket = await resolveTicketForAttendance(eventId, studentId);
  await ticket.ref.update({
    status: 'attended',
    attendedAt: FieldValue.serverTimestamp(),
    attendanceMethod: 'staff_scan',
    attendedBy: uid,
    updatedAt: FieldValue.serverTimestamp()
  });
  await notifyAttendanceRecorded(ticket.data, eventRecord.data);

  return {
    ok: true,
    userName: ticket.data.userName || 'Alumno',
    eventTitle: ticket.data.eventTitle || eventRecord.data.title || 'Evento'
  };
});

exports.foroMarkAttendanceByEventQr = onCall({ region: REGION }, async (request) => {
  const { uid, access } = await requireUserContext(request);
  if (access.canManageEvents) {
    throw new HttpsError('permission-denied', 'Este QR es para asistencia de estudiantes.');
  }

  const qrData = normalizeText(request.data?.qrData);
  const parts = qrData.split(':');
  if (parts.length !== 5 || parts[0] !== 'SIA' || parts[1] !== 'FORO_EVENT') {
    throw new HttpsError('invalid-argument', 'El QR del evento es invalido.');
  }

  const eventId = parts[2];
  const eventRecord = await getEventOrThrow(eventId);
  if (eventRecord.data.allowSelfCheckIn === false) {
    throw new HttpsError('failed-precondition', 'Este evento requiere validacion de asistencia por personal.');
  }
  assertCheckInAllowed(eventRecord.data);

  const runtimeSnap = await getPrivateDoc(eventId, 'runtime');
  if (!runtimeSnap.exists) {
    throw new HttpsError('failed-precondition', 'El evento aun no tiene QR habilitado.');
  }
  verifyQrPayload(qrData, 'attendance', eventId, runtimeSnap.data().attendanceSecret);

  const ticket = await resolveTicketForAttendance(eventId, uid);
  await ticket.ref.update({
    status: 'attended',
    attendedAt: FieldValue.serverTimestamp(),
    attendanceMethod: 'student_scan',
    updatedAt: FieldValue.serverTimestamp()
  });
  await notifyAttendanceRecorded(ticket.data, eventRecord.data);

  return {
    ok: true,
    eventTitle: ticket.data.eventTitle || eventRecord.data.title || 'Evento'
  };
});

exports.foroSubmitFeedback = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireUserContext(request);
  const ticketId = normalizeText(request.data?.ticketId);
  const eventId = normalizeText(request.data?.eventId);
  const rating = Math.min(5, Math.max(1, Number(request.data?.rating) || 0));
  const comment = normalizeText(request.data?.comment).slice(0, 800);

  if (!ticketId || !eventId || !rating) {
    throw new HttpsError('invalid-argument', 'Faltan datos para guardar la retroalimentacion.');
  }

  const db = getFirestore();
  const ticketRef = db.collection(C_TICKETS).doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) {
    throw new HttpsError('not-found', 'No se encontro el ticket.');
  }
  const ticket = ticketSnap.data();
  if (ticket.userId !== uid) {
    throw new HttpsError('permission-denied', 'Solo puedes opinar sobre tus asistencias.');
  }
  if (ticket.eventId !== eventId || ticket.status !== 'attended') {
    throw new HttpsError('failed-precondition', 'Solo puedes opinar sobre eventos a los que asististe.');
  }
  if (ticket.feedbackSubmitted) {
    throw new HttpsError('already-exists', 'La resena ya fue enviada.');
  }
  const attendedAt = toDate(ticket.attendedAt);
  if (!attendedAt || (Date.now() - attendedAt.getTime()) > 48 * 60 * 60 * 1000) {
    throw new HttpsError('failed-precondition', 'La ventana para enviar retroalimentacion ya cerro.');
  }

  const feedbackRef = db.collection(C_EVENTS).doc(eventId).collection('feedback').doc(ticketId);
  await db.runTransaction(async (transaction) => {
    transaction.set(feedbackRef, {
      ticketId,
      eventId,
      userId: uid,
      userName: ticket.userName || '',
      rating,
      comment,
      submittedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.update(ticketRef, {
      feedbackSubmitted: true,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

exports.foroGetEventQrPayload = onCall({ region: REGION }, async (request) => {
  const { uid } = await requireUserContext(request);
  const eventId = normalizeText(request.data?.eventId);
  const kind = normalizeKey(request.data?.kind) === 'resources' ? 'resources' : 'attendance';
  const { eventRecord } = await requireEventManager(uid, eventId);
  const runtime = await ensurePrivateRuntime(eventId);

  if (kind === 'attendance' && eventRecord.data.allowSelfCheckIn === false) {
    throw new HttpsError('failed-precondition', 'La autoasistencia por QR no esta habilitada en este evento.');
  }

  if (kind === 'resources') {
    if (!eventRecord.data.hasResources) {
      throw new HttpsError('failed-precondition', 'Este evento no tiene recursos publicados.');
    }
    const resourcesSnap = await getPrivateDoc(eventId, 'resources');
    if (!resourcesSnap.exists || resourcesSnap.data().qrEnabled !== true) {
      throw new HttpsError('failed-precondition', 'El QR de recursos no esta habilitado para este evento.');
    }
  }

  const payload = buildQrPayload(
    eventId,
    kind,
    kind === 'resources' ? runtime.resourcesSecret : runtime.attendanceSecret
  );
  return {
    ...payload,
    kind
  };
});

exports.foroGetEventResources = onCall({ region: REGION }, async (request) => {
  const { uid, access } = await requireUserContext(request);
  const eventId = normalizeText(request.data?.eventId);
  const qrData = normalizeText(request.data?.qrData);
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'Falta el evento.');
  }

  const eventRecord = await getEventOrThrow(eventId);
  const canManageThisEvent = access.isDifusion || (access.canManageEvents && eventRecord.data.createdBy === uid);
  if (!canManageThisEvent) {
    const ticket = await findUserTicket(eventId, uid);
    if (!ticket || ticket.data.status !== 'attended') {
      throw new HttpsError('permission-denied', 'Los recursos solo estan disponibles para asistentes.');
    }
    if (qrData) {
      const runtimeSnap = await getPrivateDoc(eventId, 'runtime');
      if (!runtimeSnap.exists) {
        throw new HttpsError('failed-precondition', 'Los recursos no tienen QR habilitado.');
      }
      verifyQrPayload(qrData, 'resources', eventId, runtimeSnap.data().resourcesSecret);
    }
  }

  const resourcesSnap = await getPrivateDoc(eventId, 'resources');
  if (!resourcesSnap.exists) {
    return {
      items: [],
      event: {
        id: eventId,
        title: eventRecord.data.title || 'Evento'
      }
    };
  }

  if (qrData && resourcesSnap.data().qrEnabled !== true) {
    throw new HttpsError('failed-precondition', 'El QR de recursos no esta habilitado para este evento.');
  }

  return {
    items: Array.isArray(resourcesSnap.data().items) ? resourcesSnap.data().items : [],
    qrEnabled: !!resourcesSnap.data().qrEnabled,
    event: {
      id: eventId,
      title: eventRecord.data.title || 'Evento',
      speaker: eventRecord.data.speaker || '',
      date: toDate(eventRecord.data.date)?.toISOString() || null
    }
  };
});

exports.foroSendUpcomingReminders = onSchedule({
  region: REGION,
  schedule: 'every 15 minutes',
  timeZone: 'America/Chihuahua'
}, async () => {
  const db = getFirestore();
  const now = new Date();

  for (const windowCfg of REMINDER_WINDOWS) {
    const start = new Date(now.getTime() + (windowCfg.minutes - windowCfg.toleranceMinutes) * 60 * 1000);
    const end = new Date(now.getTime() + (windowCfg.minutes + windowCfg.toleranceMinutes) * 60 * 1000);
    const ticketsSnap = await db.collection(C_TICKETS)
      .where('status', '==', 'registered')
      .where('eventDate', '>=', Timestamp.fromDate(start))
      .where('eventDate', '<=', Timestamp.fromDate(end))
      .get();

    if (ticketsSnap.empty) continue;

    const eventCache = new Map();
    for (const ticketDoc of ticketsSnap.docs) {
      const ticket = ticketDoc.data();
      if (ticket?.remindersSent?.[windowCfg.key]) continue;
      if (!ticket.userId || !ticket.eventId) continue;

      if (!eventCache.has(ticket.eventId)) {
        const eventSnap = await db.collection(C_EVENTS).doc(ticket.eventId).get().catch(() => null);
        eventCache.set(ticket.eventId, eventSnap?.exists ? eventSnap.data() : null);
      }
      const eventData = eventCache.get(ticket.eventId);
      if (!eventData || normalizeKey(eventData.status) !== 'active') continue;

      const eventDate = toDate(ticket.eventDate);
      const relativeLabel = windowCfg.key === '24h'
        ? 'manana'
        : (windowCfg.key === '1h' ? 'en 1 hora' : 'en 15 minutos');

      await sendNotification(ticket.userId, {
        titulo: 'Recordatorio de evento',
        mensaje: `"${ticket.eventTitle || eventData.title || 'Tu evento'}" comienza ${relativeLabel}.`,
        tipo: 'recordatorio',
        link: '/foro'
      });

      await ticketDoc.ref.update({
        [`remindersSent.${windowCfg.key}`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      if (eventDate && windowCfg.key === '15m') {
        await sendNotification(ticket.userId, {
          titulo: 'Asistencia disponible',
          mensaje: `Tu asistencia para "${ticket.eventTitle || eventData.title || 'el evento'}" ya puede registrarse.`,
          tipo: 'foro',
          link: '/foro'
        });
      }
    }
  }
});

exports.foroNotifyNewMessage = onDocumentCreated({
  document: `${C_CONVERSATIONS}/{convId}/${C_MESSAGES}/{msgId}`,
  region: REGION
}, async (event) => {
  const data = event.data?.data();
  if (!data?.senderId) return null;

  const db = getFirestore();
  const convSnap = await db.collection(C_CONVERSATIONS).doc(event.params.convId).get().catch(() => null);
  if (!convSnap?.exists) return null;
  const conv = convSnap.data();
  const targetUid = data.senderId === conv.studentId ? conv.organizerId : conv.studentId;
  if (!targetUid) return null;

  await sendNotification(targetUid, {
    titulo: 'Nuevo mensaje del evento',
    mensaje: normalizeText(data.text || 'Tienes un nuevo mensaje sobre tu evento.').slice(0, 140),
    tipo: 'foro',
    link: '/foro'
  });
  return null;
});
