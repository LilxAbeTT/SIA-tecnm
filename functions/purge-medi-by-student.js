#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DEFAULT_UID = 'G7HRuNnlePNLYr26z9ad5jBgHA82';
const DEFAULT_BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = {
    uid: DEFAULT_UID,
    dryRun: true,
    includeLegacyRoot: false,
    batchSize: DEFAULT_BATCH_SIZE,
    confirm: '',
    serviceAccount: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--uid' && next) {
      args.uid = next;
      i += 1;
      continue;
    }
    if (token === '--confirm' && next) {
      args.confirm = next;
      i += 1;
      continue;
    }
    if (token === '--service-account' && next) {
      args.serviceAccount = next;
      i += 1;
      continue;
    }
    if (token === '--batch-size' && next) {
      args.batchSize = Math.max(1, Math.min(parseInt(next, 10) || DEFAULT_BATCH_SIZE, 450));
      i += 1;
      continue;
    }
    if (token === '--execute') {
      args.dryRun = false;
      continue;
    }
    if (token === '--include-legacy-root') {
      args.includeLegacyRoot = true;
    }
  }

  return args;
}

function resolveCredential(serviceAccountArg) {
  if (serviceAccountArg) {
    const fullPath = path.resolve(process.cwd(), serviceAccountArg);
    const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return cert(json);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  const fallbackCandidates = [
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), '..', 'serviceAccountKey.json'),
  ];

  for (const candidate of fallbackCandidates) {
    if (fs.existsSync(candidate)) {
      const json = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return cert(json);
    }
  }

  throw new Error(
    'No se encontraron credenciales. Usa GOOGLE_APPLICATION_CREDENTIALS o --service-account <ruta>.'
  );
}

function ensureFirebaseApp(serviceAccountArg) {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: resolveCredential(serviceAccountArg) });
}

function toIsoDate(value) {
  try {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  } catch (_) {
    return '';
  }
}

function hasConsultationShape(data) {
  if (!data || typeof data !== 'object') return false;
  return Boolean(
    data.tipoServicio ||
    data.autorId ||
    data.diagnostico ||
    data.subjetivo ||
    data.objetivo ||
    data.plan ||
    data.createdAt ||
    data.estado
  );
}

function buildPreviewRow(kind, ref, data = {}) {
  return {
    kind,
    id: ref.id,
    path: ref.path,
    fecha: toIsoDate(data.createdAt || data.fechaHoraSlot || data.fechaConsulta || data.lastUpdate),
    studentId: data.studentId || '',
    servicio: data.tipoServicio || '',
    estado: data.estado || '',
    profesionalId: data.profesionalId || data.autorId || '',
    profesional: data.profesionalName || data.autorEmail || '',
    diagnostico: data.diagnostico || '',
  };
}

async function chunkDelete(db, refs, batchSize) {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = refs.slice(i, i + batchSize);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
    console.log(`[purge-medi] Lote confirmado: ${deleted}/${refs.length}`);
  }
  return deleted;
}

async function collectTargets(db, uid, includeLegacyRoot) {
  const refs = [];
  const preview = [];
  const seen = new Set();

  const addTarget = (ref, kind, data = {}) => {
    if (!ref?.path || seen.has(ref.path)) return;
    seen.add(ref.path);
    refs.push(ref);
    preview.push(buildPreviewRow(kind, ref, data));
  };

  const expedienteRef = db.collection('expedientes-clinicos').doc(uid);

  const tasks = [
    db.collection('citas-medi').where('studentId', '==', uid).get(),
    expedienteRef.collection('consultas').get(),
    expedienteRef.collection('consultas-privadas').get(),
  ];

  if (includeLegacyRoot) {
    tasks.push(db.collection('expedientes-clinicos').where('studentId', '==', uid).get());
  }

  const [citasSnap, consultasSnap, privadasSnap, legacySnap] = await Promise.all(tasks);

  citasSnap.forEach((doc) => addTarget(doc.ref, 'cita-medi', doc.data() || {}));
  consultasSnap.forEach((doc) => addTarget(doc.ref, 'consulta', doc.data() || {}));
  privadasSnap.forEach((doc) => addTarget(doc.ref, 'consulta-privada', doc.data() || {}));

  if (includeLegacyRoot && legacySnap) {
    legacySnap.forEach((doc) => {
      if (doc.id === uid) return;
      const data = doc.data() || {};
      if (!hasConsultationShape(data)) return;
      addTarget(doc.ref, 'legacy-root', data);
    });
  }

  preview.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  const counts = preview.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] || 0) + 1;
    return acc;
  }, {});

  return { refs, preview, counts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requiredConfirm = `BORRAR ${args.uid}`;

  if (!args.dryRun && args.confirm !== requiredConfirm) {
    throw new Error(`Confirmacion invalida. Usa --confirm "${requiredConfirm}"`);
  }

  ensureFirebaseApp(args.serviceAccount);
  const db = getFirestore();

  const { refs, preview, counts } = await collectTargets(db, args.uid, args.includeLegacyRoot);

  console.table(preview);
  console.log('[purge-medi] UID objetivo:', args.uid);
  console.log('[purge-medi] includeLegacyRoot:', args.includeLegacyRoot);
  console.log('[purge-medi] Conteo por tipo:', counts);
  console.log('[purge-medi] Total refs:', refs.length);

  if (args.dryRun) {
    console.log('[purge-medi] DRY RUN. No se borro nada.');
    return;
  }

  const deleted = await chunkDelete(db, refs, args.batchSize);
  console.log('[purge-medi] Borrado finalizado:', deleted);
}

main().catch((error) => {
  console.error('[purge-medi] Error:', error.message);
  process.exitCode = 1;
});
