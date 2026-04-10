(function () {
    const STATIONS_COLL = 'scanner-stations';

    function normalizeText(value) {
        return String(value || '').trim();
    }

    function safeJsonParse(value) {
        if (!value || typeof value !== 'string') return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function isLikelyUserQuery(value) {
        const candidate = normalizeText(value);
        if (!candidate) return false;
        return /^\d{7,10}$/.test(candidate)
            || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(candidate)
            || /^[A-Za-z0-9_-]{20,}$/.test(candidate);
    }

    function extractCandidateFromObject(source) {
        if (!source || typeof source !== 'object') return '';

        const directCandidates = [
            source.matricula,
            source.studentId,
            source.uid,
            source.email,
            source.code,
            source.id,
            source.value,
            source.data,
            source.user?.matricula,
            source.user?.uid,
            source.payload?.matricula,
            source.payload?.uid,
            source.payload?.email
        ];

        for (const candidate of directCandidates) {
            const normalized = normalizeText(candidate);
            if (normalized) return normalized;
        }

        return '';
    }

    function extractIdentifierFromScan(rawValue) {
        const raw = normalizeText(rawValue);
        if (!raw) return '';

        const parsedJson = safeJsonParse(raw);
        const objectCandidate = extractCandidateFromObject(parsedJson);
        if (objectCandidate) return objectCandidate;

        if (/^https?:\/\//i.test(raw)) {
            try {
                const url = new URL(raw);
                const urlCandidates = [
                    url.searchParams.get('matricula'),
                    url.searchParams.get('studentId'),
                    url.searchParams.get('uid'),
                    url.searchParams.get('email'),
                    url.searchParams.get('code'),
                    url.searchParams.get('id')
                ];

                for (const candidate of urlCandidates) {
                    const normalized = normalizeText(candidate);
                    if (normalized) return normalized;
                }

                const pathSegments = url.pathname.split('/').map(normalizeText).filter(Boolean);
                const strongMatch = pathSegments.find(isLikelyUserQuery);
                if (strongMatch) return strongMatch;
            } catch (error) {
                console.warn('[ScannerService] No se pudo interpretar URL de escaneo:', error);
            }
        }

        if (raw.startsWith('SIA:')) {
            const strongPart = raw.split(':').map(normalizeText).find(isLikelyUserQuery);
            return strongPart || raw;
        }

        const tokenized = raw.split(/[\s,;|]+/).map(normalizeText).filter(Boolean);
        const tokenMatch = tokenized.find(isLikelyUserQuery);
        return tokenMatch || raw;
    }

    function normalizeDate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value?.toDate === 'function') return value.toDate();
        if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
        if (typeof value === 'number') return new Date(value);
        return null;
    }

    function mapStationSnapshot(doc) {
        const data = doc.data() || {};
        const lastScan = data.lastScan || {};
        const rawCode = normalizeText(lastScan.rawCode || data.lastRawCode || '');
        const lastScanId = normalizeText(lastScan.id || data.lastScanId || '');

        return {
            stationId: doc.id,
            stationName: normalizeText(data.stationName || data.deviceName || doc.id),
            module: normalizeText(data.module || '').toLowerCase(),
            mode: normalizeText(lastScan.mode || data.mode || 'visita').toLowerCase(),
            rawCode,
            queryCandidate: extractIdentifierFromScan(rawCode),
            lastScanId,
            scanKey: `${doc.id}:${lastScanId}`,
            scannedAt: normalizeDate(lastScan.createdAt || data.updatedAt || data.lastSeenAt),
            source: normalizeText(lastScan.source || data.source || ''),
            format: normalizeText(lastScan.format || ''),
            meta: lastScan.meta || {}
        };
    }

    function listenModuleStations(ctx, moduleKey, onScan, options = {}) {
        if (!ctx?.db) {
            throw new Error('ScannerService requiere ctx.db.');
        }

        const normalizedModule = normalizeText(moduleKey).toLowerCase();
        const initialMaxAgeMs = Number(options.initialMaxAgeMs) > 0 ? Number(options.initialMaxAgeMs) : 15000;
        const seenKeys = new Map();
        let hydrated = false;

        return ctx.db.collection(STATIONS_COLL)
            .where('module', '==', normalizedModule)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'removed') {
                        seenKeys.delete(change.doc.id);
                        return;
                    }

                    const station = mapStationSnapshot(change.doc);
                    if (!station.lastScanId || !station.rawCode) return;

                    const previousKey = seenKeys.get(station.stationId);
                    seenKeys.set(station.stationId, station.scanKey);

                    if (station.scanKey === previousKey) return;
                    if (!hydrated && options.ignoreInitial !== false) {
                        const isFreshInitial = station.scannedAt
                            && (Date.now() - station.scannedAt.getTime()) <= initialMaxAgeMs;
                        if (!isFreshInitial) return;
                    }

                    try {
                        onScan(station, change);
                    } catch (error) {
                        console.error('[ScannerService] Error procesando escaneo:', error);
                    }
                });

                hydrated = true;
            }, (error) => {
                console.error('[ScannerService] Error escuchando estaciones:', error);
            });
    }

    window.ScannerService = Object.assign(window.ScannerService || {}, {
        listenModuleStations,
        extractIdentifierFromScan
    });
})();
