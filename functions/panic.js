const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const REGION = 'us-central1';
const APP_URL = 'https://sia-tecnm.web.app';
const C_USERS = 'usuarios';
const C_ALERTS = 'panic_alerts';
const ACTIVE_ALERT_STATUSES = new Set(['queued', 'dispatching', 'active']);
const TRACKABLE_ALERT_STATUSES = new Set(['queued', 'dispatching', 'active']);
const STAFF_TYPES = new Set([
  'docente',
  'administrativo',
  'operativo',
  'personal academico',
  'personal academico docente',
  'academico',
  'profesor',
  'maestro',
  'catedratico'
]);
const ADMIN_ROLES = new Set(['superadmin', 'admin', 'department_admin']);
const STAFF_ROLES = new Set([
  ...ADMIN_ROLES,
  'docente',
  'aula',
  'aula_admin',
  'medico',
  'psicologo',
  'biblio',
  'bibliotecario',
  'biblio_admin',
  'foro',
  'foro_admin',
  'cafeteria'
]);

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

function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (typeof value?.toDate === 'function') return Timestamp.fromDate(value.toDate());
  const parsed = value instanceof Date ? value : new Date(value);
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
  const {
    alertId,
    title,
    body,
    link,
    exactLocationAccess,
    exactLocation,
    recipientMode,
    audience
  } = payload;

  const data = {
    tipo: 'panic',
    alertId: String(alertId || ''),
    link: link || APP_URL,
    recipientMode: String(recipientMode || ''),
    audience: String(audience || '')
  };

  if (exactLocationAccess && exactLocation?.lat != null && exactLocation?.lng != null) {
    data.lat = String(exactLocation.lat);
    data.lng = String(exactLocation.lng);
    if (exactLocation.accuracy != null) data.accuracy = String(exactLocation.accuracy);
  }

  return {
    token,
    notification: {
      title,
      body
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'sia-general',
        tag: `sia-panic-${alertId || 'alert'}`
      }
    },
    webpush: {
      notification: {
        title,
        body,
        icon: `${APP_URL}/images/logo-sia.png`,
        badge: `${APP_URL}/assets/icons/badge-96x96.png`,
        requireInteraction: true,
        tag: `sia-panic-${alertId || 'alert'}`
      },
      fcmOptions: {
        link
      }
    },
    data
  };
}

function getDefaultPanicMainConfig() {
  return {
    enabled: true,
    allowedRecipientModes: ['custom', 'staff', 'school'],
    curatedGroups: ['docentes', 'brigada_emergencia', 'servicios_medicos', 'seguridad_campus'],
    campusZones: [
      { key: 'edificio_a', label: 'Edificio A' },
      { key: 'edificio_b', label: 'Edificio B' },
      { key: 'biblioteca', label: 'Biblioteca' },
      { key: 'laboratorios', label: 'Laboratorios' },
      { key: 'cafeteria', label: 'Cafeteria' },
      { key: 'explanada', label: 'Explanada' }
    ],
    cooldownsMinutes: {
      custom: 5,
      staff: 15,
      school: 60
    },
    tracking: {
      foregroundOnly: true,
      maxDurationSeconds: 300,
      distanceThresholdMeters: 15,
      minIntervalSeconds: 10
    },
    channels: {
      push: true,
      inApp: true,
      email: true,
      smsCritical: true
    },
    ui: {
      holdToConfirmMs: 1800,
      requireReasonFor: ['staff', 'school']
    },
    privacy: {
      schoolWideAudience: 'zone_only',
      responderAudience: 'exact_location'
    },
    responderUids: [],
    smsCriticalRecipients: [],
    templates: {
      custom: {
        title: 'Alerta de seguridad',
        protocol: 'Activar canal de apoyo y confirmar atencion.'
      },
      staff: {
        title: 'Alerta para todo el personal',
        protocol: 'Seguir protocolo institucional y confirmar atencion.'
      },
      school: {
        title: 'Alerta institucional',
        protocol: 'Compartir indicaciones sin exponer la ubicacion exacta a estudiantes.'
      }
    }
  };
}

function getDefaultPanicGroupsConfig() {
  return {
    docentes: {
      key: 'docentes',
      label: 'Docentes',
      mode: 'dynamic',
      dynamicType: 'docentes',
      memberUids: [],
      emails: [],
      phones: []
    },
    brigada_emergencia: {
      key: 'brigada_emergencia',
      label: 'Brigada de emergencia',
      mode: 'managed',
      memberUids: [],
      emails: [],
      phones: []
    },
    servicios_medicos: {
      key: 'servicios_medicos',
      label: 'Servicios medicos',
      mode: 'managed',
      memberUids: [],
      emails: [],
      phones: []
    },
    seguridad_campus: {
      key: 'seguridad_campus',
      label: 'Seguridad del campus',
      mode: 'managed',
      memberUids: [],
      emails: [],
      phones: []
    }
  };
}

function mergeMainConfig(raw) {
  const defaults = getDefaultPanicMainConfig();
  const data = raw && typeof raw === 'object' ? raw : {};
  const cooldowns = data.cooldownsMinutes || data.cooldownMinutes || {};
  const tracking = {
    ...(data.tracking || {})
  };
  if (tracking.windowSeconds != null && tracking.maxDurationSeconds == null) {
    tracking.maxDurationSeconds = tracking.windowSeconds;
  }
  if (tracking.minDistanceMeters != null && tracking.distanceThresholdMeters == null) {
    tracking.distanceThresholdMeters = tracking.minDistanceMeters;
  }
  const merged = {
    ...defaults,
    ...data,
    cooldownsMinutes: {
      ...defaults.cooldownsMinutes,
      ...cooldowns
    },
    tracking: {
      ...defaults.tracking,
      ...tracking
    },
    channels: {
      ...defaults.channels,
      ...(data.channels || {})
    },
    ui: {
      ...defaults.ui,
      ...(data.ui || {})
    },
    privacy: {
      ...defaults.privacy,
      ...(data.privacy || {})
    },
    templates: {
      ...defaults.templates,
      ...(data.templates || {})
    }
  };

  merged.allowedRecipientModes = normalizeArray(merged.allowedRecipientModes).map(normalizeKey);
  merged.curatedGroups = normalizeArray(merged.curatedGroups).map(normalizeKey);
  merged.responderUids = normalizeArray(merged.responderUids);
  merged.smsCriticalRecipients = normalizeArray(merged.smsCriticalRecipients);
  merged.campusZones = Array.isArray(merged.campusZones) && merged.campusZones.length
    ? merged.campusZones.map((zone) => {
      if (typeof zone === 'string') {
        const key = normalizeKey(zone);
        return { key, label: normalizeText(zone) };
      }
      return {
        key: normalizeKey(zone?.key || zone?.label || zone?.value),
        label: normalizeText(zone?.label || zone?.name || zone?.value || zone?.key)
      };
    }).filter((zone) => zone.key && zone.label)
    : defaults.campusZones;

  return merged;
}

function mergeGroupsConfig(raw) {
  const defaults = getDefaultPanicGroupsConfig();
  const data = raw && typeof raw === 'object' ? raw : {};
  const keys = new Set([
    ...Object.keys(defaults),
    ...Object.keys(data || {})
  ]);

  const merged = {};
  keys.forEach((key) => {
    const normalizedKey = normalizeKey(key);
    const defaultEntry = defaults[key] || defaults[normalizedKey] || {
      key: normalizedKey,
      label: normalizeText(key),
      mode: 'managed',
      memberUids: [],
      emails: [],
      phones: []
    };
    const rawEntry = data[key] || data[normalizedKey] || {};
    merged[normalizedKey] = {
      ...defaultEntry,
      ...rawEntry,
      key: normalizedKey,
      label: normalizeText(rawEntry.label || defaultEntry.label || key),
      mode: normalizeKey(rawEntry.mode || defaultEntry.mode || 'managed') || 'managed',
      dynamicType: normalizeKey(rawEntry.dynamicType || defaultEntry.dynamicType || ''),
      memberUids: normalizeArray(rawEntry.memberUids || defaultEntry.memberUids),
      emails: normalizeArray(rawEntry.emails || defaultEntry.emails).map((value) => value.toLowerCase()),
      phones: normalizeArray(rawEntry.phones || defaultEntry.phones)
    };
  });
  return merged;
}

async function loadPanicConfig(db) {
  const [mainSnap, groupsSnap] = await Promise.all([
    db.collection('config').doc('panic_main').get(),
    db.collection('config').doc('panic_groups').get()
  ]);

  return {
    main: mergeMainConfig(mainSnap.exists ? mainSnap.data() : null),
    groups: mergeGroupsConfig(groupsSnap.exists ? groupsSnap.data() : null)
  };
}

function buildInitiatorSnapshot(profile, uid) {
  return {
    uid,
    displayName: normalizeText(profile?.displayName || profile?.nombre || 'Usuario'),
    email: normalizeText(profile?.emailInstitucional || profile?.email || profile?.emailPersonal || ''),
    matricula: normalizeText(profile?.matricula || ''),
    telefono: normalizeText(profile?.telefono || profile?.contactoEmergenciaTel || ''),
    career: normalizeText(profile?.career || profile?.carrera || ''),
    role: normalizeText(profile?.role || ''),
    tipoUsuario: normalizeText(profile?.tipoUsuario || '')
  };
}

function isActiveProfile(profile) {
  const status = normalizeKey(profile?.status || 'active');
  return !status || status === 'active';
}

function resolveServerSideEligibility(profile) {
  const explicit = profile?.safetyProfile?.canUsePanicFab;
  if (typeof explicit === 'boolean') return explicit;
  const genero = normalizeKey(
    profile?.genero
    || profile?.personalData?.genero
    || profile?.sexo
    || profile?.personalData?.sexo
  );
  return ['femenino', 'mujer', 'female'].includes(genero);
}

async function ensureSafetyProfile(ref, profile) {
  const explicit = profile?.safetyProfile?.canUsePanicFab;
  if (typeof explicit === 'boolean') {
    return profile;
  }

  const computed = resolveServerSideEligibility(profile);
  const nextProfile = {
    ...profile,
    safetyProfile: {
      ...(profile?.safetyProfile || {}),
      canUsePanicFab: computed,
      source: normalizeText(profile?.safetyProfile?.source || 'server_backfill_v1')
    }
  };

  await ref.set({
    safetyProfile: nextProfile.safetyProfile,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return nextProfile;
}

async function requireUserContext(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
  }

  const db = getFirestore();
  const ref = db.collection(C_USERS).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('failed-precondition', 'No se encontro tu perfil institucional.');
  }

  const profile = await ensureSafetyProfile(ref, snap.data() || {});
  return { db, uid, ref, profile };
}

function getRecentAlertQuery(db, uid, limit = 12) {
  return db.collection(C_ALERTS)
    .where('initiatorUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limit);
}

async function getRecentAlertsForUser(db, uid, limit = 12) {
  const snap = await getRecentAlertQuery(db, uid, limit).get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ref: doc.ref,
    ...doc.data()
  }));
}

function resolveActiveAlert(alerts) {
  return alerts.find((alert) => ACTIVE_ALERT_STATUSES.has(normalizeKey(alert.status))) || null;
}

function getCooldownMinutesForMode(config, recipientMode) {
  const key = normalizeKey(recipientMode);
  const value = Number(config?.main?.cooldownsMinutes?.[key]);
  if (Number.isFinite(value) && value > 0) return value;
  return getDefaultPanicMainConfig().cooldownsMinutes[key] || 5;
}

function resolveCooldownBucket(recipientMode, minutes) {
  const bucketMs = Math.max(1, Number(minutes) || 5) * 60 * 1000;
  return `${recipientMode}_${Math.floor(Date.now() / bucketMs)}`;
}

function findMostRecentModeAlert(alerts, mode) {
  const targetMode = normalizeKey(mode);
  return alerts.find((alert) => normalizeKey(alert.recipientMode) === targetMode) || null;
}

function ensureCampusZone(config, requestedZone) {
  const zoneValue = normalizeText(requestedZone);
  const normalizedZone = normalizeKey(zoneValue);
  const zone = (config?.main?.campusZones || []).find((item) => item.key === normalizedZone || normalizeKey(item.label) === normalizedZone);
  if (zone) {
    return {
      key: zone.key,
      label: zone.label
    };
  }
  if (!zoneValue) return null;
  return {
    key: normalizedZone || zoneValue.toLowerCase(),
    label: zoneValue
  };
}

function sanitizeLocationPayload(rawLocation) {
  if (!rawLocation || typeof rawLocation !== 'object') return null;
  const lat = Number(rawLocation.lat);
  const lng = Number(rawLocation.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  const point = {
    lat,
    lng,
    accuracy: Number.isFinite(Number(rawLocation.accuracy)) ? Number(rawLocation.accuracy) : null,
    heading: Number.isFinite(Number(rawLocation.heading)) ? Number(rawLocation.heading) : null,
    speed: Number.isFinite(Number(rawLocation.speed)) ? Number(rawLocation.speed) : null,
    source: normalizeKey(rawLocation.source || 'browser_geolocation') || 'browser_geolocation',
    precision: normalizeKey(rawLocation.precision || 'gps') || 'gps'
  };

  const capturedAt = parseTimestamp(rawLocation.capturedAt || rawLocation.timestamp || rawLocation.clientTimestamp);
  if (capturedAt) {
    point.capturedAt = capturedAt;
  }

  return point;
}

function buildExactLocationPayload(location, campusZone) {
  if (!location) return null;
  return {
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
    source: location.source,
    precision: location.precision,
    campusZoneKey: campusZone?.key || '',
    campusZoneLabel: campusZone?.label || '',
    capturedAt: location.capturedAt || Timestamp.now()
  };
}

function buildTrackPointPayload(location, campusZone, manualReference, actorUid) {
  return {
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy,
    heading: location.heading,
    speed: location.speed,
    source: location.source,
    precision: location.precision,
    campusZoneKey: campusZone?.key || '',
    campusZoneLabel: campusZone?.label || '',
    manualReference: normalizeText(manualReference || ''),
    actorUid: normalizeText(actorUid || ''),
    timestamp: location.capturedAt || Timestamp.now(),
    createdAt: FieldValue.serverTimestamp()
  };
}

function sanitizeCreatePayload(rawData, config) {
  const allowedModes = new Set(config.main.allowedRecipientModes || []);
  const recipientMode = normalizeKey(rawData?.recipientMode || 'custom') || 'custom';
  if (!allowedModes.has(recipientMode)) {
    throw new HttpsError('invalid-argument', 'El destino de la alerta no esta habilitado.');
  }

  const campusZone = ensureCampusZone(config, rawData?.campusZone || rawData?.zone || rawData?.campusZoneLabel);
  if (!campusZone) {
    throw new HttpsError('invalid-argument', 'Debes indicar la zona o edificio del campus.');
  }

  const selectedGroups = normalizeArray(rawData?.selectedGroups).map(normalizeKey)
    .filter((groupKey) => (config.main.curatedGroups || []).includes(groupKey));
  if (recipientMode === 'custom' && selectedGroups.length === 0) {
    selectedGroups.push('docentes');
  }

  const requireReason = new Set(normalizeArray(config.main.ui?.requireReasonFor).map(normalizeKey));
  const reason = normalizeText(rawData?.reason).slice(0, 400);
  if (requireReason.has(recipientMode) && !reason) {
    throw new HttpsError('invalid-argument', 'Debes escribir un motivo breve para este nivel de alerta.');
  }

  const manualReference = normalizeText(rawData?.manualReference || rawData?.reference).slice(0, 180);
  const exactLocation = sanitizeLocationPayload(rawData?.exactLocation || rawData?.location);
  if (!exactLocation && !manualReference) {
    throw new HttpsError('invalid-argument', 'Si no hay GPS disponible, debes describir una referencia manual.');
  }

  return {
    recipientMode,
    selectedGroups,
    reason,
    campusZone,
    manualReference,
    exactLocation,
    channels: {
      push: !!config.main.channels?.push,
      inApp: !!config.main.channels?.inApp,
      email: !!config.main.channels?.email,
      smsCritical: !!config.main.channels?.smsCritical
    },
    privacyMode: {
      schoolWideAudience: normalizeKey(config.main.privacy?.schoolWideAudience || 'zone_only') || 'zone_only',
      responderAudience: normalizeKey(config.main.privacy?.responderAudience || 'exact_location') || 'exact_location'
    },
    clientRequestId: normalizeText(rawData?.clientRequestId || '').slice(0, 80)
  };
}

async function logSystemEvent(db, actor, action, details = {}, severity = 'info') {
  const actorSnapshot = actor || {};
  try {
    await db.collection('system-logs').add({
      adminId: normalizeText(actorSnapshot.uid || actorSnapshot.adminId || 'system'),
      adminName: normalizeText(actorSnapshot.displayName || actorSnapshot.adminName || 'Sistema'),
      adminEmail: normalizeText(actorSnapshot.email || actorSnapshot.adminEmail || ''),
      action,
      details,
      module: 'panic',
      severity,
      timestamp: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn('[panic] No se pudo escribir en system-logs:', error);
  }
}

async function writeAlertEvent(alertRef, type, payload = {}) {
  const eventPayload = {
    type,
    createdAt: FieldValue.serverTimestamp(),
    ...payload
  };
  await alertRef.collection('events').add(eventPayload);
}

async function createRejectedAudit(db, context, reasonCode, reasonMessage, rawPayload = {}) {
  const alertRef = db.collection(C_ALERTS).doc();
  const actor = buildInitiatorSnapshot(context.profile, context.uid);
  const config = context.config || { main: getDefaultPanicMainConfig() };
  const zone = ensureCampusZone(config, rawPayload?.campusZone || rawPayload?.zone);
  const payload = {
    initiatorUid: context.uid,
    initiatorSnapshot: actor,
    recipientMode: normalizeKey(rawPayload?.recipientMode || 'custom') || 'custom',
    selectedGroups: normalizeArray(rawPayload?.selectedGroups).map(normalizeKey),
    status: 'rejected',
    rejectionCode: normalizeKey(reasonCode || 'invalid_attempt') || 'invalid_attempt',
    rejectionReason: normalizeText(reasonMessage || 'Intento rechazado'),
    reason: normalizeText(rawPayload?.reason || '').slice(0, 400),
    campusZone: zone,
    manualReference: normalizeText(rawPayload?.manualReference || rawPayload?.reference || '').slice(0, 180),
    exactLocation: buildExactLocationPayload(sanitizeLocationPayload(rawPayload?.exactLocation || rawPayload?.location), zone),
    channels: {
      push: false,
      inApp: false,
      email: false,
      smsCritical: false
    },
    dispatchSummary: {
      recipientCount: 0,
      pushCount: 0,
      emailCount: 0,
      smsCount: 0,
      notificationCount: 0,
      ackCount: 0,
      errorCount: 1,
      lastError: normalizeText(reasonMessage || 'Intento rechazado')
    },
    cooldownBucket: '',
    privacyMode: {
      schoolWideAudience: normalizeKey(config.main.privacy?.schoolWideAudience || 'zone_only') || 'zone_only',
      responderAudience: normalizeKey(config.main.privacy?.responderAudience || 'exact_location') || 'exact_location'
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    resolvedAt: FieldValue.serverTimestamp()
  };

  await alertRef.set(payload);
  await writeAlertEvent(alertRef, 'rejected', {
    actorUid: context.uid,
    actorName: actor.displayName,
    reasonCode: payload.rejectionCode,
    reasonMessage: payload.rejectionReason
  });
  await logSystemEvent(db, actor, 'PANIC_ALERT_REJECTED', {
    alertId: alertRef.id,
    reasonCode: payload.rejectionCode,
    reasonMessage: payload.rejectionReason,
    recipientMode: payload.recipientMode
  }, 'warning');
}

function getEmailCandidates(profile) {
  return new Set(
    normalizeArray([
      profile?.emailInstitucional,
      profile?.email,
      profile?.emailPersonal
    ]).map((value) => value.toLowerCase())
  );
}

function getPhoneCandidates(profile) {
  return new Set(
    normalizeArray([
      profile?.telefono,
      profile?.contactoEmergenciaTel,
      profile?.healthData?.contactoEmergenciaTel
    ])
  );
}

function isDocenteProfile(profile) {
  const tipoUsuario = normalizeKey(profile?.tipoUsuario);
  if (STAFF_TYPES.has(tipoUsuario)) {
    return ['docente', 'personal academico', 'personal academico docente', 'academico', 'profesor', 'maestro', 'catedratico']
      .includes(tipoUsuario);
  }

  const role = normalizeKey(profile?.role);
  if (role === 'docente' || role === 'aula' || role === 'aula_admin') return true;

  const jobTitle = normalizeKey(profile?.originalJobTitle || profile?.jobTitle || profile?.puesto || profile?.especialidad);
  return /(docente|profesor|maestro|catedratic|academico)/.test(jobTitle);
}

function isAdminLikeProfile(profile) {
  return ADMIN_ROLES.has(normalizeKey(profile?.role));
}

function isStaffProfile(profile) {
  const role = normalizeKey(profile?.role);
  if (STAFF_ROLES.has(role)) return true;

  const tipoUsuario = normalizeKey(profile?.tipoUsuario);
  if (STAFF_TYPES.has(tipoUsuario)) return true;

  const permissions = profile?.permissions || {};
  const permissionValues = Object.values(permissions).map((value) => normalizeKey(value));
  if (permissionValues.some((value) => ['admin', 'docente', 'medico', 'psicologo', 'biblio', 'superadmin'].includes(value))) {
    return true;
  }

  const jobTitle = normalizeKey(profile?.originalJobTitle || profile?.jobTitle || profile?.puesto || profile?.especialidad);
  return /(administrativ|seguridad|brigada|medic|salud|docente|profesor|operativ)/.test(jobTitle);
}

function isManagedResponder(config, uid) {
  if (!uid) return false;
  if ((config.main.responderUids || []).includes(uid)) return true;
  return Object.values(config.groups || {}).some((group) => {
    if (!group || group.key === 'docentes') return false;
    return normalizeArray(group.memberUids).includes(uid);
  });
}

function canManagePanicResponses(profile, uid, config) {
  return isAdminLikeProfile(profile) || isStaffProfile(profile) || isManagedResponder(config, uid);
}

function resolveSchoolWideAudience(profile, uid, config) {
  if (isAdminLikeProfile(profile) || isManagedResponder(config, uid)) return 'responder';
  if (isStaffProfile(profile)) return 'staff';
  return 'student';
}

function buildNotificationCopy(alertData, recipient) {
  const zoneLabel = normalizeText(alertData?.campusZone?.label || alertData?.campusZone?.key || 'Campus');
  const initiatorName = normalizeText(alertData?.initiatorSnapshot?.displayName || 'Una usuaria');
  const manualReference = normalizeText(alertData?.manualReference || '');
  const reason = normalizeText(alertData?.reason || '');
  const exactLocation = recipient.exactLocationAccess && alertData?.exactLocation?.lat != null && alertData?.exactLocation?.lng != null
    ? `${Number(alertData.exactLocation.lat).toFixed(5)}, ${Number(alertData.exactLocation.lng).toFixed(5)}`
    : '';

  if (recipient.audience === 'student') {
    return {
      title: `Alerta de seguridad en ${zoneLabel}`,
      body: [
        `Se activo un protocolo preventivo en ${zoneLabel}.`,
        manualReference ? `Referencia: ${manualReference}.` : '',
        'Mantente atenta a las indicaciones institucionales.'
      ].filter(Boolean).join(' ')
    };
  }

  const details = [
    `Zona: ${zoneLabel}`,
    manualReference ? `Referencia: ${manualReference}` : '',
    reason ? `Motivo: ${reason}` : '',
    exactLocation ? `GPS: ${exactLocation}` : ''
  ].filter(Boolean);

  return {
    title: `Alerta de panico: ${initiatorName}`,
    body: `${initiatorName} solicito apoyo. ${details.join(' | ')}`
  };
}

function buildNotificationRecord(alertId, alertData, recipient) {
  const copy = buildNotificationCopy(alertData, recipient);
  return {
    titulo: copy.title,
    mensaje: copy.body,
    tipo: 'sistema',
    link: '/dashboard',
    urgente: true,
    leido: false,
    createdAt: FieldValue.serverTimestamp(),
    meta: {
      skipPushTrigger: true,
      skipLocalEcho: true,
      panic: {
        alertId,
        recipientMode: normalizeKey(alertData?.recipientMode || ''),
        audience: recipient.audience,
        exactLocationAccess: recipient.exactLocationAccess,
        campusZoneKey: normalizeText(alertData?.campusZone?.key || ''),
        campusZoneLabel: normalizeText(alertData?.campusZone?.label || '')
      }
    }
  };
}

function buildRecipientRecord(recipient) {
  return {
    uid: recipient.uid,
    displayName: recipient.displayName,
    email: recipient.email,
    audience: recipient.audience,
    exactLocationAccess: recipient.exactLocationAccess,
    channels: recipient.channels,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    acknowledgedAt: null,
    resolvedAt: null
  };
}

function buildMailPayload(alertData, recipient) {
  const copy = buildNotificationCopy(alertData, recipient);
  return {
    to: recipient.email,
    message: {
      subject: copy.title,
      text: `${copy.body}\n\nAbre SIA para mas detalle: ${resolveNotificationLink('/dashboard')}`
    },
    meta: {
      alertId: normalizeText(alertData?.id || ''),
      audience: recipient.audience,
      module: 'panic'
    },
    createdAt: FieldValue.serverTimestamp()
  };
}

function buildSmsBody(alertData) {
  const zoneLabel = normalizeText(alertData?.campusZone?.label || alertData?.campusZone?.key || 'Campus');
  const initiatorName = normalizeText(alertData?.initiatorSnapshot?.displayName || 'Una usuaria');
  const manualReference = normalizeText(alertData?.manualReference || '');
  const exactLocation = alertData?.exactLocation?.lat != null && alertData?.exactLocation?.lng != null
    ? `${Number(alertData.exactLocation.lat).toFixed(5)}, ${Number(alertData.exactLocation.lng).toFixed(5)}`
    : '';

  return [
    `SIA PANICO: ${initiatorName}`,
    `Zona ${zoneLabel}.`,
    manualReference ? `Ref ${manualReference}.` : '',
    exactLocation ? `GPS ${exactLocation}.` : '',
    'Revisa SIA.'
  ].filter(Boolean).join(' ');
}

function buildSmsPayload(alertData, phone) {
  return {
    to: phone,
    body: buildSmsBody(alertData),
    meta: {
      alertId: normalizeText(alertData?.id || ''),
      module: 'panic'
    },
    createdAt: FieldValue.serverTimestamp()
  };
}

function dedupeRecipients(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.uid) return false;
    if (seen.has(item.uid)) return false;
    seen.add(item.uid);
    return true;
  });
}

async function getAllActiveUsers(db) {
  const snapshot = await db.collection(C_USERS).get();
  return snapshot.docs
    .map((doc) => ({
      uid: doc.id,
      ref: doc.ref,
      profile: doc.data() || {}
    }))
    .filter((entry) => entry.profile && isActiveProfile(entry.profile));
}

function hydrateManagedGroupMembers(group, users) {
  const uidSet = new Set(normalizeArray(group?.memberUids));
  const emailSet = new Set(normalizeArray(group?.emails).map((value) => value.toLowerCase()));
  const phoneSet = new Set(normalizeArray(group?.phones));

  return users.filter((entry) => {
    if (uidSet.has(entry.uid)) return true;
    const emails = getEmailCandidates(entry.profile);
    const phones = getPhoneCandidates(entry.profile);
    const hasEmail = [...emails].some((email) => emailSet.has(email));
    const hasPhone = [...phones].some((phone) => phoneSet.has(phone));
    return hasEmail || hasPhone;
  });
}

function resolveRecipientsForAlert(alertData, config, users) {
  const mode = normalizeKey(alertData.recipientMode || 'custom') || 'custom';
  let recipients = [];

  if (mode === 'school') {
    recipients = users;
  } else if (mode === 'staff') {
    recipients = users.filter((entry) => isStaffProfile(entry.profile));
  } else {
    const selectedGroups = normalizeArray(alertData.selectedGroups).map(normalizeKey);
    selectedGroups.forEach((groupKey) => {
      if (groupKey === 'docentes') {
        recipients.push(...users.filter((entry) => isDocenteProfile(entry.profile)));
        return;
      }
      const group = config.groups[groupKey];
      if (!group) return;
      if (group.mode === 'dynamic' && normalizeKey(group.dynamicType) === 'docentes') {
        recipients.push(...users.filter((entry) => isDocenteProfile(entry.profile)));
        return;
      }
      recipients.push(...hydrateManagedGroupMembers(group, users));
    });
  }

  const deduped = dedupeRecipients(recipients).map((entry) => {
    const audience = resolveSchoolWideAudience(entry.profile, entry.uid, config);
    const exactLocationAccess = audience !== 'student';
    return {
      uid: entry.uid,
      ref: entry.ref,
      displayName: normalizeText(entry.profile.displayName || entry.profile.nombre || entry.profile.emailInstitucional || entry.uid),
      email: normalizeText(entry.profile.emailInstitucional || entry.profile.email || entry.profile.emailPersonal || ''),
      audience,
      exactLocationAccess,
      channels: {
        push: !!config.main.channels?.push,
        inApp: !!config.main.channels?.inApp,
        email: !!config.main.channels?.email,
        smsCritical: !!config.main.channels?.smsCritical
      },
      profile: entry.profile
    };
  });

  return deduped.filter((recipient) => recipient.uid !== alertData.initiatorUid);
}

function resolveSmsTargets(alertData, config) {
  const phones = new Set(normalizeArray(config.main.smsCriticalRecipients));
  const selectedGroups = normalizeArray(alertData.selectedGroups).map(normalizeKey);
  const responderGroups = ['brigada_emergencia', 'servicios_medicos', 'seguridad_campus'];
  const candidateGroups = normalizeKey(alertData.recipientMode) === 'custom'
    ? selectedGroups
    : responderGroups;

  candidateGroups.forEach((groupKey) => {
    const group = config.groups[groupKey];
    normalizeArray(group?.phones).forEach((phone) => phones.add(phone));
  });

  return [...phones].filter(Boolean);
}

async function commitBatchedOperations(operations) {
  const db = getFirestore();
  const commits = [];
  let batch = db.batch();
  let count = 0;

  operations.forEach((operation) => {
    if (!operation?.ref || !operation.type) return;
    if (operation.type === 'set') {
      batch.set(operation.ref, operation.data, operation.options || {});
    } else if (operation.type === 'update') {
      batch.update(operation.ref, operation.data);
    } else if (operation.type === 'delete') {
      batch.delete(operation.ref);
    }
    count += 1;
    if (count >= 380) {
      commits.push(batch.commit());
      batch = db.batch();
      count = 0;
    }
  });

  if (count > 0) {
    commits.push(batch.commit());
  }

  if (commits.length) {
    await Promise.all(commits);
  }
}

async function loadPushTokenEntries(userRef) {
  const snapshot = await userRef.collection('pushTokens').get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() || {};
      const token = normalizeText(data.fcmToken || data.token || '');
      if (!token) return null;
      return {
        id: doc.id,
        ref: doc.ref,
        token
      };
    })
    .filter(Boolean);
}

async function sendDirectPush(recipient, alertData) {
  const tokenEntries = await loadPushTokenEntries(recipient.ref);
  if (!tokenEntries.length) {
    return { ok: 0, attempted: 0, invalidRefs: [] };
  }

  const copy = buildNotificationCopy(alertData, recipient);
  const payload = {
    alertId: alertData.id,
    title: copy.title,
    body: copy.body,
    link: resolveNotificationLink('/dashboard'),
    exactLocationAccess: recipient.exactLocationAccess,
    exactLocation: alertData.exactLocation,
    recipientMode: alertData.recipientMode,
    audience: recipient.audience
  };

  const results = await Promise.allSettled(
    tokenEntries.map((entry) => getMessaging().send(buildPushMessage(entry.token, payload)))
  );

  let ok = 0;
  const invalidRefs = [];

  results.forEach((result, index) => {
    const entry = tokenEntries[index];
    if (result.status === 'fulfilled') {
      ok += 1;
      return;
    }

    if (isInvalidTokenError(result.reason)) {
      invalidRefs.push(entry.ref);
      return;
    }

    console.error(`[panic] Error enviando FCM directo a ${recipient.uid}/${entry.id}:`, result.reason);
  });

  if (invalidRefs.length) {
    await Promise.all(invalidRefs.map((ref) => ref.delete().catch(() => null)));
  }

  return {
    ok,
    attempted: tokenEntries.length,
    invalidRefs
  };
}

async function createUserNotification(db, targetUid, data, docId = '') {
  const ref = docId
    ? db.collection(C_USERS).doc(targetUid).collection('notificaciones').doc(docId)
    : db.collection(C_USERS).doc(targetUid).collection('notificaciones').doc();

  await ref.set({
    titulo: normalizeText(data.titulo || data.title || 'Notificacion'),
    mensaje: normalizeText(data.mensaje || data.message || ''),
    tipo: normalizeText(data.tipo || data.type || 'info') || 'info',
    link: normalizeText(data.link || '/dashboard') || '/dashboard',
    urgente: !!data.urgente,
    leido: false,
    meta: data.meta || {},
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

exports.panicCreateAlert = onCall({ region: REGION }, async (request) => {
  const context = await requireUserContext(request);
  const { db, uid, profile } = context;
  const config = await loadPanicConfig(db);
  context.config = config;

  if (!config.main.enabled) {
    await createRejectedAudit(db, context, 'disabled', 'El boton de panico esta deshabilitado.', request.data || {});
    throw new HttpsError('failed-precondition', 'El boton de panico no esta disponible en este momento.');
  }

  if (!isActiveProfile(profile)) {
    await createRejectedAudit(db, context, 'inactive_profile', 'Tu perfil no se encuentra activo.', request.data || {});
    throw new HttpsError('permission-denied', 'Tu perfil no esta activo.');
  }

  if (!resolveServerSideEligibility(profile)) {
    await createRejectedAudit(db, context, 'not_eligible', 'Tu perfil no esta habilitado para este flujo.', request.data || {});
    throw new HttpsError('permission-denied', 'Tu perfil no esta habilitado para usar el boton de panico.');
  }

  let payload;
  try {
    payload = sanitizeCreatePayload(request.data || {}, config);
  } catch (error) {
    await createRejectedAudit(db, context, 'invalid_payload', error?.message || 'Solicitud invalida.', request.data || {});
    throw error;
  }

  const recentAlerts = await getRecentAlertsForUser(db, uid, 12);
  const activeAlert = resolveActiveAlert(recentAlerts);
  if (activeAlert) {
    await writeAlertEvent(activeAlert.ref, 'duplicate_reused', {
      actorUid: uid,
      actorName: normalizeText(profile.displayName || profile.email || uid)
    });
    return {
      alertId: activeAlert.id,
      reusedExisting: true,
      status: activeAlert.status || 'active'
    };
  }

  const latestSameMode = findMostRecentModeAlert(recentAlerts, payload.recipientMode);
  const cooldownMinutes = getCooldownMinutesForMode(config, payload.recipientMode);
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const latestCreatedAt = toDate(latestSameMode?.createdAt);
  if (latestCreatedAt && (Date.now() - latestCreatedAt.getTime()) < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - (Date.now() - latestCreatedAt.getTime())) / 1000);
    await createRejectedAudit(db, context, 'cooldown', `Espera ${retryAfterSeconds}s antes de enviar otra alerta de este tipo.`, request.data || {});
    throw new HttpsError('resource-exhausted', `Espera ${retryAfterSeconds}s antes de volver a intentarlo.`);
  }

  const alertRef = db.collection(C_ALERTS).doc();
  const alertData = {
    initiatorUid: uid,
    initiatorSnapshot: buildInitiatorSnapshot(profile, uid),
    recipientMode: payload.recipientMode,
    selectedGroups: payload.selectedGroups,
    status: 'queued',
    reason: payload.reason,
    campusZone: payload.campusZone,
    manualReference: payload.manualReference,
    exactLocation: buildExactLocationPayload(payload.exactLocation, payload.campusZone),
    channels: payload.channels,
    dispatchSummary: {
      recipientCount: 0,
      pushCount: 0,
      emailCount: 0,
      smsCount: 0,
      notificationCount: 0,
      ackCount: 0,
      errorCount: 0
    },
    cooldownBucket: resolveCooldownBucket(payload.recipientMode, cooldownMinutes),
    privacyMode: payload.privacyMode,
    clientRequestId: payload.clientRequestId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    resolvedAt: null
  };

  await alertRef.set(alertData);
  await writeAlertEvent(alertRef, 'created', {
    actorUid: uid,
    actorName: alertData.initiatorSnapshot.displayName,
    recipientMode: payload.recipientMode,
    selectedGroups: payload.selectedGroups,
    campusZone: payload.campusZone,
    hasExactLocation: !!payload.exactLocation
  });

  if (payload.exactLocation) {
    await alertRef.collection('trackPoints').add(buildTrackPointPayload(
      payload.exactLocation,
      payload.campusZone,
      payload.manualReference,
      uid
    ));
  }

  await logSystemEvent(db, alertData.initiatorSnapshot, 'PANIC_ALERT_CREATED', {
    alertId: alertRef.id,
    recipientMode: payload.recipientMode,
    selectedGroups: payload.selectedGroups,
    campusZoneKey: payload.campusZone?.key || '',
    campusZoneLabel: payload.campusZone?.label || ''
  }, 'warning');

  return {
    alertId: alertRef.id,
    reusedExisting: false,
    status: 'queued'
  };
});

exports.panicDispatchAlert = onDocumentCreated({
  document: `${C_ALERTS}/{alertId}`,
  region: REGION
}, async (event) => {
  const alertId = event.params.alertId;
  const initialData = event.data?.data();
  if (!initialData || normalizeKey(initialData.status) !== 'queued') {
    return null;
  }

  const db = getFirestore();
  const alertRef = db.collection(C_ALERTS).doc(alertId);
  const claimed = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(alertRef);
    if (!snap.exists) return false;
    const alertData = snap.data() || {};
    if (normalizeKey(alertData.status) !== 'queued') return false;
    transaction.update(alertRef, {
      status: 'dispatching',
      updatedAt: FieldValue.serverTimestamp(),
      'dispatchSummary.startedAt': FieldValue.serverTimestamp()
    });
    return true;
  });

  if (!claimed) {
    return null;
  }

  const currentSnap = await alertRef.get();
  if (!currentSnap.exists) return null;
  const alertData = {
    id: alertId,
    ...currentSnap.data()
  };

  try {
    const config = await loadPanicConfig(db);
    const users = await getAllActiveUsers(db);
    const recipients = resolveRecipientsForAlert(alertData, config, users);

    if (!recipients.length) {
      await alertRef.update({
        status: 'error',
        updatedAt: FieldValue.serverTimestamp(),
        'dispatchSummary.errorCount': FieldValue.increment(1),
        'dispatchSummary.lastError': 'No se resolvieron destinatarios para esta alerta.'
      });
      await writeAlertEvent(alertRef, 'dispatch_error', {
        reasonCode: 'no_recipients',
        reasonMessage: 'No se resolvieron destinatarios.'
      });
      await logSystemEvent(db, alertData.initiatorSnapshot, 'PANIC_ALERT_DISPATCH_ERROR', {
        alertId,
        reasonCode: 'no_recipients'
      }, 'error');
      return null;
    }

    const operations = [];
    const queuedChannels = [];
    recipients.forEach((recipient) => {
      const notifRef = db.collection(C_USERS).doc(recipient.uid).collection('notificaciones').doc(`panic_${alertId}`);
      operations.push({
        type: 'set',
        ref: notifRef,
        data: buildNotificationRecord(alertId, alertData, recipient),
        options: { merge: true }
      });

      const recipientRef = alertRef.collection('recipients').doc(recipient.uid);
      operations.push({
        type: 'set',
        ref: recipientRef,
        data: buildRecipientRecord(recipient),
        options: { merge: true }
      });

      if (recipient.channels.email && recipient.email) {
        queuedChannels.push({
          type: 'set',
          ref: db.collection('mail').doc(),
          data: buildMailPayload(alertData, recipient)
        });
      }
    });

    const smsTargets = config.main.channels?.smsCritical ? resolveSmsTargets(alertData, config) : [];
    smsTargets.forEach((phone) => {
      queuedChannels.push({
        type: 'set',
        ref: db.collection('messages').doc(),
        data: buildSmsPayload(alertData, phone)
      });
    });

    await commitBatchedOperations(operations);
    await commitBatchedOperations(queuedChannels);

    let pushCount = 0;
    let pushAttempts = 0;
    for (const recipient of recipients) {
      if (!recipient.channels.push) continue;
      const pushResult = await sendDirectPush(recipient, alertData);
      pushCount += pushResult.ok;
      pushAttempts += pushResult.attempted;
    }

    const emailCount = queuedChannels.filter((entry) => entry.ref.parent.id === 'mail').length;
    const smsCount = queuedChannels.filter((entry) => entry.ref.parent.id === 'messages').length;

    await alertRef.update({
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
      'dispatchSummary.recipientCount': recipients.length,
      'dispatchSummary.pushCount': pushCount,
      'dispatchSummary.emailCount': emailCount,
      'dispatchSummary.smsCount': smsCount,
      'dispatchSummary.notificationCount': recipients.length,
      'dispatchSummary.ackCount': 0,
      'dispatchSummary.errorCount': 0,
      'dispatchSummary.pushAttempts': pushAttempts,
      'dispatchSummary.completedAt': FieldValue.serverTimestamp()
    });

    await writeAlertEvent(alertRef, 'dispatch_completed', {
      recipientCount: recipients.length,
      pushCount,
      emailCount,
      smsCount,
      pushAttempts
    });

    await logSystemEvent(db, alertData.initiatorSnapshot, 'PANIC_ALERT_DISPATCHED', {
      alertId,
      recipientCount: recipients.length,
      pushCount,
      emailCount,
      smsCount
    }, 'warning');
  } catch (error) {
    console.error('[panic] Error en dispatch:', error);
    await alertRef.update({
      status: 'error',
      updatedAt: FieldValue.serverTimestamp(),
      'dispatchSummary.errorCount': FieldValue.increment(1),
      'dispatchSummary.lastError': normalizeText(error?.message || 'Error desconocido al despachar la alerta.')
    }).catch(() => null);
    await writeAlertEvent(alertRef, 'dispatch_error', {
      reasonCode: 'dispatch_failure',
      reasonMessage: normalizeText(error?.message || 'Error desconocido al despachar la alerta.')
    }).catch(() => null);
    await logSystemEvent(db, alertData?.initiatorSnapshot || {}, 'PANIC_ALERT_DISPATCH_ERROR', {
      alertId,
      reasonCode: 'dispatch_failure',
      reasonMessage: normalizeText(error?.message || 'Error desconocido')
    }, 'error');
  }

  return null;
});

exports.panicUpdateLocation = onCall({ region: REGION }, async (request) => {
  const { db, uid, profile } = await requireUserContext(request);
  const alertId = normalizeText(request.data?.alertId);
  if (!alertId) {
    throw new HttpsError('invalid-argument', 'Falta la alerta.');
  }

  const alertRef = db.collection(C_ALERTS).doc(alertId);
  const alertSnap = await alertRef.get();
  if (!alertSnap.exists) {
    throw new HttpsError('not-found', 'La alerta no existe.');
  }

  const alertData = alertSnap.data() || {};
  if (alertData.initiatorUid !== uid) {
    throw new HttpsError('permission-denied', 'Solo la usuaria que creo la alerta puede actualizar su ubicacion.');
  }
  if (!TRACKABLE_ALERT_STATUSES.has(normalizeKey(alertData.status))) {
    throw new HttpsError('failed-precondition', 'La alerta ya no admite seguimiento.');
  }

  const config = await loadPanicConfig(db);
  const point = sanitizeLocationPayload(request.data?.point || request.data?.location);
  if (!point) {
    await createRejectedAudit(db, { db, uid, profile, config }, 'invalid_location', 'Se intento enviar una ubicacion invalida.', request.data || {});
    throw new HttpsError('invalid-argument', 'La ubicacion no es valida.');
  }

  const campusZone = ensureCampusZone(config, request.data?.campusZone || alertData?.campusZone?.label || alertData?.campusZone?.key) || alertData?.campusZone || null;
  const manualReference = normalizeText(request.data?.manualReference || alertData?.manualReference || '').slice(0, 180);
  const exactLocation = buildExactLocationPayload(point, campusZone);

  await alertRef.collection('trackPoints').add(buildTrackPointPayload(point, campusZone, manualReference, uid));
  await alertRef.update({
    exactLocation,
    campusZone,
    manualReference,
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    alertId
  };
});

exports.panicAcknowledgeAlert = onCall({ region: REGION }, async (request) => {
  const { db, uid, profile } = await requireUserContext(request);
  const alertId = normalizeText(request.data?.alertId);
  if (!alertId) {
    throw new HttpsError('invalid-argument', 'Falta la alerta.');
  }

  const config = await loadPanicConfig(db);
  if (!canManagePanicResponses(profile, uid, config)) {
    throw new HttpsError('permission-denied', 'No tienes permisos para confirmar esta alerta.');
  }

  const alertRef = db.collection(C_ALERTS).doc(alertId);
  const ackRef = alertRef.collection('acks').doc(uid);
  const recipientRef = alertRef.collection('recipients').doc(uid);
  let alertData = null;
  let isNewAck = false;

  await db.runTransaction(async (transaction) => {
    const [alertSnap, ackSnap, recipientSnap] = await Promise.all([
      transaction.get(alertRef),
      transaction.get(ackRef),
      transaction.get(recipientRef)
    ]);

    if (!alertSnap.exists) {
      throw new HttpsError('not-found', 'La alerta no existe.');
    }

    alertData = alertSnap.data() || {};
    if (!ACTIVE_ALERT_STATUSES.has(normalizeKey(alertData.status))) {
      throw new HttpsError('failed-precondition', 'La alerta ya no esta activa.');
    }

    if (!recipientSnap.exists && !isAdminLikeProfile(profile)) {
      throw new HttpsError('permission-denied', 'No formas parte de los destinatarios registrados.');
    }

    isNewAck = !ackSnap.exists;
    transaction.set(ackRef, {
      uid,
      displayName: normalizeText(profile.displayName || profile.email || uid),
      email: normalizeText(profile.emailInstitucional || profile.email || ''),
      acknowledgedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.set(recipientRef, {
      acknowledgedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.update(alertRef, {
      updatedAt: FieldValue.serverTimestamp(),
      ...(isNewAck ? { 'dispatchSummary.ackCount': FieldValue.increment(1) } : {})
    });
  });

  await writeAlertEvent(alertRef, 'acknowledged', {
    actorUid: uid,
    actorName: normalizeText(profile.displayName || profile.email || uid)
  });

  if (isNewAck && alertData?.initiatorUid) {
    await createUserNotification(db, alertData.initiatorUid, {
      titulo: 'Alerta confirmada',
      mensaje: `${normalizeText(profile.displayName || profile.email || 'Personal autorizado')} confirmo tu alerta de seguridad.`,
      tipo: 'sistema',
      link: '/dashboard',
      urgente: true,
      meta: {
        panic: {
          alertId
        }
      }
    });
  }

  return {
    ok: true,
    alertId,
    acknowledged: true,
    isNewAck
  };
});

exports.panicResolveAlert = onCall({ region: REGION }, async (request) => {
  const { db, uid, profile } = await requireUserContext(request);
  const alertId = normalizeText(request.data?.alertId);
  if (!alertId) {
    throw new HttpsError('invalid-argument', 'Falta la alerta.');
  }

  const alertRef = db.collection(C_ALERTS).doc(alertId);
  const alertSnap = await alertRef.get();
  if (!alertSnap.exists) {
    throw new HttpsError('not-found', 'La alerta no existe.');
  }

  const alertData = alertSnap.data() || {};
  if (!ACTIVE_ALERT_STATUSES.has(normalizeKey(alertData.status))) {
    throw new HttpsError('failed-precondition', 'La alerta ya no esta activa.');
  }

  const config = await loadPanicConfig(db);
  const isInitiator = alertData.initiatorUid === uid;
  if (!isInitiator && !canManagePanicResponses(profile, uid, config)) {
    throw new HttpsError('permission-denied', 'No tienes permisos para cerrar esta alerta.');
  }

  const resolutionType = normalizeKey(request.data?.resolution?.type || request.data?.type || 'resolved') || 'resolved';
  const resolutionNotes = normalizeText(
    request.data?.resolution?.notes
    || request.data?.resolution?.comment
    || request.data?.notes
    || ''
  ).slice(0, 400);

  if (isInitiator && !['false_alarm', 'safe', 'cancelled'].includes(resolutionType)) {
    throw new HttpsError('permission-denied', 'La usuaria solo puede cerrar la alerta como falsa alarma o a salvo.');
  }

  const nextStatus = ['false_alarm', 'cancelled'].includes(resolutionType) ? 'cancelled' : 'resolved';
  await alertRef.update({
    status: nextStatus,
    resolvedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    resolution: {
      type: resolutionType,
      notes: resolutionNotes,
      actorUid: uid,
      actorName: normalizeText(profile.displayName || profile.email || uid),
      actorRole: normalizeText(profile.role || '')
    }
  });

  await writeAlertEvent(alertRef, 'resolved', {
    actorUid: uid,
    actorName: normalizeText(profile.displayName || profile.email || uid),
    resolutionType,
    resolutionNotes
  });

  if (!isInitiator && alertData.initiatorUid) {
    await createUserNotification(db, alertData.initiatorUid, {
      titulo: nextStatus === 'cancelled' ? 'Alerta cerrada' : 'Alerta resuelta',
      mensaje: `${normalizeText(profile.displayName || profile.email || 'Personal autorizado')} actualizo tu alerta como ${nextStatus === 'cancelled' ? 'cerrada' : 'resuelta'}.`,
      tipo: 'sistema',
      link: '/dashboard',
      urgente: true,
      meta: {
        panic: {
          alertId,
          resolutionType
        }
      }
    });
  }

  await logSystemEvent(db, buildInitiatorSnapshot(profile, uid), 'PANIC_ALERT_RESOLVED', {
    alertId,
    resolutionType,
    nextStatus
  }, 'warning');

  return {
    ok: true,
    alertId,
    status: nextStatus
  };
});
