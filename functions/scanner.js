const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const REGION = 'us-central1';
const STATIONS_COLL = 'scanner-stations';
const DEVICE_SECRET = String(process.env.SIA_SCANNER_INGEST_KEY || '').trim();

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeModuleKey(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || 'general';
}

function normalizeMode(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['prestamo', 'loan'].includes(normalized)) return 'prestamo';
  if (['devolucion', 'return', 'devolucion_libro'].includes(normalized)) return 'devolucion';
  if (['pc', 'computadora', 'computadoras'].includes(normalized)) return 'pc';
  if (['servicio', 'reserva'].includes(normalized)) return 'servicio';
  return 'visita';
}

function sanitizeStationId(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'scanner-default';
}

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SIA-Device-Key');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function readDeviceSecret(req) {
  const authHeader = normalizeText(req.get('authorization'));
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return normalizeText(authHeader.slice(7));
  }
  return normalizeText(req.get('x-sia-device-key'));
}

exports.ingestScannerEvent = onRequest({ region: REGION, cors: false }, async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  if (!DEVICE_SECRET) {
    res.status(500).json({ ok: false, error: 'scanner-secret-missing' });
    return;
  }

  const providedSecret = readDeviceSecret(req);
  if (!providedSecret || providedSecret !== DEVICE_SECRET) {
    res.status(401).json({ ok: false, error: 'invalid-device-secret' });
    return;
  }

  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const rawCode = normalizeText(body.rawCode || body.code || body.value);
  if (!rawCode) {
    res.status(400).json({ ok: false, error: 'missing-raw-code' });
    return;
  }

  const moduleKey = normalizeModuleKey(body.module || body.area || 'general');
  const mode = normalizeMode(body.mode || body.action || body.flow || '');
  const stationId = sanitizeStationId(body.stationId || body.deviceId || body.stationName || `${moduleKey}-scanner`);
  const stationName = normalizeText(body.stationName || body.deviceName || stationId);
  const scanId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const payload = {
    module: moduleKey,
    mode,
    area: normalizeModuleKey(body.area || moduleKey),
    stationId,
    stationName,
    deviceId: normalizeText(body.deviceId || stationId),
    deviceType: normalizeText(body.deviceType || 'm5stack'),
    source: normalizeText(body.source || 'hardware_scanner'),
    status: 'online',
    updatedAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
    lastScan: {
      id: scanId,
      rawCode,
      mode,
      format: normalizeText(body.format || 'qr'),
      source: normalizeText(body.source || 'hardware_scanner'),
      createdAt: FieldValue.serverTimestamp(),
      meta: {
        via: 'https_ingest',
        module: moduleKey,
        ip: normalizeText(req.ip),
        rssi: body.rssi ?? null,
        lora: body.lora === true
      }
    }
  };

  await getFirestore().collection(STATIONS_COLL).doc(stationId).set(payload, { merge: true });

  res.status(200).json({
    ok: true,
    module: moduleKey,
    stationId,
    scanId
  });
});
