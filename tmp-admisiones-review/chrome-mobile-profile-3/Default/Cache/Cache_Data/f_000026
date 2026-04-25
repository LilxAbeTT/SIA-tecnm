(function (global) {
  if (global.PanicService) return;

  const ACTIVE_ALERT_STATUSES = new Set(['queued', 'dispatching', 'active']);
  const TERMINAL_ALERT_STATUSES = new Set(['resolved', 'cancelled', 'error', 'rejected']);
  const DEFAULT_MAIN_CONFIG = {
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
    cooldownsMinutes: { custom: 5, staff: 15, school: 60 },
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
    }
  };

  const DEFAULT_GROUPS_CONFIG = {
    docentes: { key: 'docentes', label: 'Docentes', mode: 'dynamic', dynamicType: 'docentes', memberUids: [], emails: [], phones: [] },
    brigada_emergencia: { key: 'brigada_emergencia', label: 'Brigada de emergencia', mode: 'managed', memberUids: [], emails: [], phones: [] },
    servicios_medicos: { key: 'servicios_medicos', label: 'Servicios medicos', mode: 'managed', memberUids: [], emails: [], phones: [] },
    seguridad_campus: { key: 'seguridad_campus', label: 'Seguridad del campus', mode: 'managed', memberUids: [], emails: [], phones: [] }
  };

  const state = {
    ctx: null,
    profile: null,
    uid: null,
    config: {
      main: DEFAULT_MAIN_CONFIG,
      groups: DEFAULT_GROUPS_CONFIG
    },
    configLoaded: false,
    latestAlert: null,
    alertUnsub: null,
    watchId: null,
    watchInFlight: false,
    lastCapture: null,
    lastSentPoint: null,
    trackingActive: false,
    trackingError: '',
    visibilityBound: false
  };

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

  function mergeMainConfig(raw) {
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
    return {
      ...DEFAULT_MAIN_CONFIG,
      ...data,
      cooldownsMinutes: {
        ...DEFAULT_MAIN_CONFIG.cooldownsMinutes,
        ...cooldowns
      },
      tracking: {
        ...DEFAULT_MAIN_CONFIG.tracking,
        ...tracking
      },
      channels: {
        ...DEFAULT_MAIN_CONFIG.channels,
        ...(data.channels || {})
      },
      ui: {
        ...DEFAULT_MAIN_CONFIG.ui,
        ...(data.ui || {})
      },
      privacy: {
        ...DEFAULT_MAIN_CONFIG.privacy,
        ...(data.privacy || {})
      },
      allowedRecipientModes: normalizeArray(data.allowedRecipientModes || DEFAULT_MAIN_CONFIG.allowedRecipientModes).map(normalizeKey),
      curatedGroups: normalizeArray(data.curatedGroups || DEFAULT_MAIN_CONFIG.curatedGroups).map(normalizeKey),
      campusZones: Array.isArray(data.campusZones) && data.campusZones.length
        ? data.campusZones.map((zone) => ({
          key: normalizeKey(zone?.key || zone?.label || zone?.value),
          label: normalizeText(zone?.label || zone?.name || zone?.value || zone?.key)
        })).filter((zone) => zone.key && zone.label)
        : DEFAULT_MAIN_CONFIG.campusZones
    };
  }

  function mergeGroupsConfig(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const keys = new Set([...Object.keys(DEFAULT_GROUPS_CONFIG), ...Object.keys(data)]);
    const groups = {};
    keys.forEach((key) => {
      const normalizedKey = normalizeKey(key);
      const base = DEFAULT_GROUPS_CONFIG[key] || DEFAULT_GROUPS_CONFIG[normalizedKey] || { key: normalizedKey, label: normalizeText(key) };
      const incoming = data[key] || data[normalizedKey] || {};
      groups[normalizedKey] = {
        ...base,
        ...incoming,
        key: normalizedKey,
        label: normalizeText(incoming.label || base.label || key),
        mode: normalizeKey(incoming.mode || base.mode || 'managed') || 'managed',
        dynamicType: normalizeKey(incoming.dynamicType || base.dynamicType || ''),
        memberUids: normalizeArray(incoming.memberUids || base.memberUids),
        emails: normalizeArray(incoming.emails || base.emails),
        phones: normalizeArray(incoming.phones || base.phones)
      };
    });
    return groups;
  }

  function getDb() {
    return state.ctx?.db || global.SIA?.db || null;
  }

  function getFunctions() {
    return state.ctx?.functions || global.SIA?.functions || null;
  }

  function getCurrentUid(profile = state.profile) {
    return (
      profile?.uid ||
      state.ctx?.user?.uid ||
      state.ctx?.auth?.currentUser?.uid ||
      global.SIA?.auth?.currentUser?.uid ||
      null
    );
  }

  function canUsePanicFab(profile = state.profile) {
    if (!profile) return false;
    if (typeof profile?.safetyProfile?.canUsePanicFab === 'boolean') {
      return profile.safetyProfile.canUsePanicFab;
    }
    if (typeof global.SIA?.canUsePanicFab === 'function') {
      return !!global.SIA.canUsePanicFab(profile);
    }
    return false;
  }

  function getAlertPhase(alert = state.latestAlert) {
    const status = normalizeKey(alert?.status || '');
    if (!alert) return 'idle';
    if (ACTIVE_ALERT_STATUSES.has(status)) return 'active';
    if (TERMINAL_ALERT_STATUSES.has(status)) return 'terminal';
    return 'idle';
  }

  function serializeState() {
    return {
      uid: state.uid,
      eligible: canUsePanicFab(),
      alert: state.latestAlert,
      phase: getAlertPhase(),
      config: state.config,
      tracking: {
        active: state.trackingActive,
        error: state.trackingError,
        lastCapture: state.lastCapture,
        lastSentPoint: state.lastSentPoint
      }
    };
  }

  function emitState() {
    global.dispatchEvent(new CustomEvent('sia-panic-state-changed', {
      detail: serializeState()
    }));
  }

  async function loadConfig(force = false) {
    const db = getDb();
    if (!db) return state.config;
    if (state.configLoaded && !force) return state.config;

    const [mainSnap, groupsSnap] = await Promise.all([
      db.collection('config').doc('panic_main').get().catch(() => null),
      db.collection('config').doc('panic_groups').get().catch(() => null)
    ]);

    state.config = {
      main: mergeMainConfig(mainSnap?.exists ? mainSnap.data() : null),
      groups: mergeGroupsConfig(groupsSnap?.exists ? groupsSnap.data() : null)
    };
    state.configLoaded = true;
    emitState();
    return state.config;
  }

  function unbindAlertSubscription() {
    if (state.alertUnsub) {
      state.alertUnsub();
      state.alertUnsub = null;
    }
  }

  function ensureVisibilityHandlers() {
    if (state.visibilityBound) return;
    state.visibilityBound = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', stopTracking);
    window.addEventListener('focus', handleVisibilityChange);
  }

  function removeVisibilityHandlers() {
    if (!state.visibilityBound) return;
    state.visibilityBound = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', stopTracking);
    window.removeEventListener('focus', handleVisibilityChange);
  }

  function subscribeToActiveAlert(uid = state.uid) {
    unbindAlertSubscription();
    const db = getDb();
    if (!db || !uid) return null;

    state.alertUnsub = db.collection('panic_alerts')
      .where('initiatorUid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot((snapshot) => {
        if (snapshot.empty) {
          state.latestAlert = null;
          stopTracking();
          emitState();
          return;
        }

        const doc = snapshot.docs[0];
        state.latestAlert = { id: doc.id, ...doc.data() };
        if (getAlertPhase(state.latestAlert) === 'active') {
          ensureTracking();
        } else {
          stopTracking();
        }
        emitState();
      }, (error) => {
        console.warn('[PanicService] Error suscribiendo alerta activa:', error);
        state.trackingError = error?.message || 'No se pudo sincronizar la alerta activa.';
        emitState();
      });

    return state.alertUnsub;
  }

  function bindSession(ctx, profile) {
    const nextUid = getCurrentUid(profile || state.profile || null);
    const sessionChanged = nextUid !== state.uid;
    state.ctx = ctx || state.ctx || global.SIA || null;
    state.profile = profile || state.profile || global.SIA?.currentUserProfile || null;

    if (!nextUid) {
      cleanup();
      return;
    }

    state.uid = nextUid;
    ensureVisibilityHandlers();
    if (sessionChanged) {
      state.latestAlert = null;
      state.lastCapture = null;
      state.lastSentPoint = null;
      state.trackingError = '';
      stopTracking();
    }

    loadConfig().catch((error) => {
      console.warn('[PanicService] No se pudo cargar la configuracion:', error);
    });
    subscribeToActiveAlert(nextUid);
    emitState();
  }

  function cleanup() {
    unbindAlertSubscription();
    stopTracking(true);
    removeVisibilityHandlers();
    state.ctx = null;
    state.profile = null;
    state.uid = null;
    state.latestAlert = null;
    state.configLoaded = false;
    state.watchInFlight = false;
    emitState();
  }

  function callAction(name, payload = {}) {
    const functions = getFunctions();
    if (!functions?.httpsCallable) {
      throw new Error('Firebase Functions no esta disponible.');
    }
    return functions.httpsCallable(name)(payload).then((result) => result?.data || {});
  }

  function toMillis(value) {
    if (!value) return Date.now();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
  }

  function distanceMeters(a, b) {
    if (!a || !b) return 0;
    const toRad = (value) => (Number(value) * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(Number(b.lat) - Number(a.lat));
    const dLng = toRad(Number(b.lng) - Number(a.lng));
    const lat1 = toRad(Number(a.lat));
    const lat2 = toRad(Number(b.lat));
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function shouldSendPoint(point) {
    if (!state.lastSentPoint) return true;
    const tracking = state.config?.main?.tracking || DEFAULT_MAIN_CONFIG.tracking;
    const minDistance = Number(tracking.distanceThresholdMeters) || 15;
    const minIntervalMs = (Number(tracking.minIntervalSeconds) || 10) * 1000;
    const elapsedMs = toMillis(point?.capturedAt) - toMillis(state.lastSentPoint?.capturedAt);
    return distanceMeters(state.lastSentPoint, point) >= minDistance || elapsedMs >= minIntervalMs;
  }

  function normalizeBrowserPosition(position) {
    return {
      lat: Number(position?.coords?.latitude),
      lng: Number(position?.coords?.longitude),
      accuracy: Number.isFinite(Number(position?.coords?.accuracy)) ? Number(position.coords.accuracy) : null,
      heading: Number.isFinite(Number(position?.coords?.heading)) ? Number(position.coords.heading) : null,
      speed: Number.isFinite(Number(position?.coords?.speed)) ? Number(position.coords.speed) : null,
      source: 'browser_geolocation',
      precision: 'gps',
      capturedAt: new Date(position?.timestamp || Date.now()).toISOString()
    };
  }

  function getFriendlyGeoError(error) {
    if (error?.code === 1) return 'Permiso de ubicacion denegado.';
    if (error?.code === 2) return 'No fue posible obtener la ubicacion.';
    if (error?.code === 3) return 'La ubicacion tardo demasiado en responder.';
    return error?.message || 'No fue posible leer la ubicacion.';
  }

  function captureCurrentLocation(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalizacion no disponible.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = normalizeBrowserPosition(position);
          state.lastCapture = point;
          state.trackingError = '';
          emitState();
          resolve(point);
        },
        (error) => {
          const friendly = new Error(getFriendlyGeoError(error));
          state.trackingError = friendly.message;
          emitState();
          reject(friendly);
        },
        {
          enableHighAccuracy: options.enableHighAccuracy !== false,
          maximumAge: options.maximumAgeMs || 0,
          timeout: options.timeoutMs || 15000
        }
      );
    });
  }

  async function updateLocation(alertId, point) {
    const payload = await callAction('panicUpdateLocation', {
      alertId,
      point
    });
    state.lastSentPoint = point;
    state.trackingError = '';
    emitState();
    return payload;
  }

  async function createAlert(payload = {}) {
    const result = await callAction('panicCreateAlert', payload);
    if (result?.alertId && payload?.exactLocation && result?.reusedExisting) {
      await updateLocation(result.alertId, payload.exactLocation).catch(() => null);
    }
    return result;
  }

  function shouldTrackCurrentAlert() {
    return getAlertPhase(state.latestAlert) === 'active';
  }

  function stopTracking(clearError = false) {
    if (state.watchId != null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(state.watchId);
    }
    state.watchId = null;
    state.watchInFlight = false;
    state.trackingActive = false;
    if (clearError) state.trackingError = '';
    emitState();
  }

  async function pushWatchPoint(point) {
    if (!state.latestAlert?.id || state.watchInFlight) return;
    if (!shouldSendPoint(point)) return;
    state.watchInFlight = true;
    try {
      await updateLocation(state.latestAlert.id, point);
    } catch (error) {
      state.trackingError = error?.message || 'No se pudo actualizar la ubicacion.';
      emitState();
    } finally {
      state.watchInFlight = false;
    }
  }

  function ensureTracking() {
    if (!shouldTrackCurrentAlert() || document.hidden || !navigator.geolocation) {
      stopTracking();
      return;
    }
    if (state.watchId != null) return;

    state.trackingActive = true;
    state.trackingError = '';
    emitState();
    state.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = normalizeBrowserPosition(position);
        state.lastCapture = point;
        emitState();
        pushWatchPoint(point).catch(() => null);
      },
      (error) => {
        state.trackingActive = false;
        state.trackingError = getFriendlyGeoError(error);
        emitState();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopTracking();
      return;
    }
    if (shouldTrackCurrentAlert()) {
      ensureTracking();
    }
  }

  function getConfig() {
    return state.config;
  }

  function getState() {
    return serializeState();
  }

  function getCampusZoneOptions() {
    return Array.isArray(state.config?.main?.campusZones) ? state.config.main.campusZones : [];
  }

  function getMapsUrl(alert = state.latestAlert) {
    const location = alert?.exactLocation;
    if (!location || location.lat == null || location.lng == null) return '';
    return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  }

  const service = {
    bindSession,
    cleanup,
    loadConfig,
    getConfig,
    getState,
    getCampusZoneOptions,
    getMapsUrl,
    canUsePanicFab,
    subscribeToActiveAlert,
    captureCurrentLocation,
    createAlert,
    updateLocation,
    acknowledgeAlert(alertId) {
      return callAction('panicAcknowledgeAlert', { alertId });
    },
    resolveAlert(alertId, resolution = {}) {
      return callAction('panicResolveAlert', { alertId, resolution });
    }
  };

  global.PanicService = service;
})(window);
