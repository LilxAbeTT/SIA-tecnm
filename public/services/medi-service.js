// services/medi-service.js
// Servicio de Datos para Módulo Medi
// Separa la lógica de Firestore de la UI

const MediService = (function () {
    const C_CITAS = 'citas-medi';
    const C_EXP = 'expedientes-clinicos';
    const C_PRIVATE_CONSULTAS = 'consultas-privadas';
    const SLOTS_COLL = 'medi-slots'; // Legacy — ya no se usa para nuevas reservas
    const CONFIG_COLL = 'medi-config';
    const MAX_CITAS_PER_SLOT = 4; // 1 agendada + 3 en cola
    const DEFAULT_MEDICAL_PROFESSIONAL = Object.freeze({
        name: 'Dra. Ang\u00E9lica Guadalupe Manr\u00EDquez Cota',
        displayName: 'Dra. Ang\u00E9lica Guadalupe Manr\u00EDquez Cota',
        specialty: 'M\u00E9dico General U.A.G',
        cedula: '132456789',
        cedulaLabel: 'CP 132456789',
        phone: '6121053936',
        email: 'atencionmedica@loscabos.tecnm.mx'
    });
    const DEFAULT_PRESCRIPTION_TEMPLATE_URL = '/images/Receta.png';

    // Default config (fallback si no hay en Firestore)
    let config = {
        slotStart: 8,
        slotEnd: 22,
        slotStep: 30, // Visual step (Legacy) - Now we use slotDuration
        slotDuration: 60, // [NEW] Default duration in minutes (45 or 60)
        diasHabiles: [1, 2, 3, 4, 5], // Lun-Vie
        availableMédico: true,
        availablePsicologo: true, // Legacy (will be mapped to Mat/Vesp if needed or kept for backwards compatibility)
        availablePsicologoMatutino: true,
        availablePsicologoVespertino: true,
        disabledHours_Médico: [],
        disabledHours_Psicologo: []
    };



    // --- HELPERS ---
    const pad = n => String(n).padStart(2, '0');
    const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const slotIdFromDate = d =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}:${pad(d.getMinutes())}`;

    // Helper robusto para fechas (Timestamp, Date, String, Number)
    const safeDate = (val) => {
        if (!val) return null;
        if (val.toDate) return val.toDate();
        if (val instanceof Date) return val;
        return new Date(val);
    };
    const normalizePinInput = (pin) => String(pin ?? '').trim();
    const normalizeSigns = (data = {}) => {
        const signs = data.signos || {};
        return {
            temp: signs.temp ?? data.temp ?? null,
            presion: signs.presion ?? data.presion ?? null,
            peso: signs.peso ?? data.peso ?? null,
            talla: signs.talla ?? data.talla ?? null,
        };
    };

    const ts = d => firebase.firestore.Timestamp.fromDate(d);

    async function hashPinValue(pin) {
        const normalizedPin = normalizePinInput(pin);
        if (!normalizedPin) return null;
        if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') return null;

        const data = new TextEncoder().encode(normalizedPin);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    async function profilePinMatches(profile = {}, candidatePin) {
        const normalizedPin = normalizePinInput(candidatePin);
        if (!normalizedPin) return false;

        if (profile.pinHash) {
            const hashedCandidate = await hashPinValue(normalizedPin);
            return !!hashedCandidate && hashedCandidate === profile.pinHash;
        }

        return normalizePinInput(profile.pin) === normalizedPin;
    }

    // --- CONFIG MANAGEMENT ---
    async function loadConfig(ctx) {
        try {
            const snap = await ctx.db.collection(CONFIG_COLL).doc('schedule').get();
            if (snap.exists) {
                const data = snap.data();
                config = { ...config, ...data };
                console.log('✅ [MediService] Config cargada:', config);
            } else {
                console.log('⚠️ [MediService] No hay config en Firestore, usando defaults (Silencioso)');
            }
        } catch (e) {
            if (e.code === 'permission-denied') {
                console.warn('⚠️ [MediService] Sin permisos para leer config (usando defaults).');
            } else {
                console.error('❌ [MediService] Error cargando config:', e);
            }
        }
        return config;
    }

    async function updateConfig(ctx, newConfig) {
        try {
            await ctx.db.collection(CONFIG_COLL).doc('schedule').set(newConfig, { merge: true });
            config = { ...config, ...newConfig };
            return { success: true };
        } catch (e) {
            console.error('❌ [MediService] Error guardando config:', e);
            return { success: false, error: e.message };
        }
    }

    function getConfig() {
        return config;
    }

    function normalizeServiceRole(role) {
        return String(role || '').toLowerCase().includes('psic') ? 'Psicologo' : 'Médico';
    }

    function normalizeShiftTag(shift, fallbackDate = null) {
        const directDate = safeDate(shift);
        if (directDate && !Number.isNaN(directDate.getTime())) {
            return directDate.getHours() < 15 ? 'Matutino' : 'Vespertino';
        }

        const raw = String(shift || '').toLowerCase();
        if (raw.includes('mat')) return 'Matutino';
        if (raw.includes('vesp')) return 'Vespertino';

        const date = safeDate(fallbackDate);
        if (!date || Number.isNaN(date.getTime())) return null;
        return date.getHours() < 15 ? 'Matutino' : 'Vespertino';
    }

    function getScopedConfigKeys(prefix, role, shiftTag = null, profileId = null) {
        const normalizedRole = normalizeServiceRole(role);
        const normalizedShift = normalizeShiftTag(shiftTag);
        const keys = [];

        if (profileId) keys.push(`${prefix}_profile_${profileId}`);
        if (normalizedShift) keys.push(`${prefix}_${normalizedRole}_${normalizedShift}`);
        keys.push(`${prefix}_${normalizedRole}`);

        if (normalizedRole === 'Psicologo') keys.push(`${prefix}_Psicologo`);
        if (normalizedRole === 'Médico') keys.push(`${prefix}_Médico`);

        return Array.from(new Set(keys.filter(Boolean)));
    }

    function readScopedConfigValue(cfg, keys, fallbackValue) {
        for (const key of keys) {
            if (cfg && Object.prototype.hasOwnProperty.call(cfg, key) && cfg[key] != null) {
                return cfg[key];
            }
        }
        return fallbackValue;
    }

    function getSlotDurationForContext(cfg = config, role, shiftTag = null, profileId = null) {
        const raw = readScopedConfigValue(
            cfg,
            getScopedConfigKeys('slotDuration', role, shiftTag, profileId),
            cfg?.slotDuration || 60
        );
        const parsed = parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
    }

    function getDisabledHoursForContext(cfg = config, role, shiftTag = null, profileId = null) {
        const raw = readScopedConfigValue(
            cfg,
            getScopedConfigKeys('disabledHours', role, shiftTag, profileId),
            []
        );
        return Array.isArray(raw) ? raw : [];
    }

    function getAvailabilityKeyForContext(role, shiftTag = null) {
        const normalizedRole = normalizeServiceRole(role);
        const normalizedShift = normalizeShiftTag(shiftTag);

        if (normalizedRole === 'Psicologo') {
            if (normalizedShift === 'Matutino') return 'availablePsicologoMatutino';
            if (normalizedShift === 'Vespertino') return 'availablePsicologoVespertino';
            return 'availablePsicologo';
        }

        return 'availableMédico';
    }

    function getPauseUntilKeyForContext(role, shiftTag = null, profileId = null) {
        return getScopedConfigKeys('pauseUntil', role, shiftTag, profileId)[0] || 'pauseUntil_MÃ©dico';
    }

    function getPauseUntilForContext(cfg = config, role, shiftTag = null, profileId = null) {
        const pauseRaw = readScopedConfigValue(
            cfg,
            getScopedConfigKeys('pauseUntil', role, shiftTag, profileId),
            null
        );
        const pauseDate = safeDate(pauseRaw);
        if (!pauseDate || Number.isNaN(pauseDate.getTime())) return null;
        return pauseDate.getTime() > Date.now() ? pauseDate : null;
    }

    function isServiceEnabledForContext(cfg = config, role, shiftTag = null, profileId = null) {
        const availabilityEnabled = cfg?.[getAvailabilityKeyForContext(role, shiftTag)] !== false;
        const pauseUntil = getPauseUntilForContext(cfg, role, shiftTag, profileId);
        return availabilityEnabled && !pauseUntil;
    }

    function matchesPsychologyScope(data, ownerUid, shiftTag, profileId, dateValue = null, ownerField = 'autorId') {
        if (!data) return false;

        const storedOwner = data[ownerField] || data.profesionalId || null;
        if (ownerUid && storedOwner && storedOwner !== ownerUid) return false;

        const storedProfileId = data.profesionalProfileId || null;
        if (profileId && storedProfileId) {
            return storedProfileId === profileId;
        }

        const effectiveShift = normalizeShiftTag(
            data.shift || data.profesionalShift,
            dateValue || data.fechaHoraSlot || data.createdAt
        );

        if (shiftTag) {
            return effectiveShift === normalizeShiftTag(shiftTag);
        }

        return true;
    }

    function matchesConsultationScope(data, role, ownerUid, shiftTag, profileId) {
        const normalizedRole = normalizeServiceRole(role);
        if (normalizedRole === 'Psicologo') {
            return matchesPsychologyScope(data, ownerUid, shiftTag, profileId, data.createdAt, 'autorId');
        }

        if (!data) return false;
        if (ownerUid && data?.autorId && data.autorId !== ownerUid) return false;

        const storedProfileId = data.profesionalProfileId || null;
        if (profileId && storedProfileId && storedProfileId !== profileId) return false;

        const effectiveShift = normalizeShiftTag(
            data.shift || data.profesionalShift,
            data.createdAt
        );
        if (shiftTag && effectiveShift && effectiveShift !== normalizeShiftTag(shiftTag)) return false;

        return true;
    }

    function matchesAppointmentScope(data, role, ownerUid, shiftTag, profileId, { includeUnassignedMedical = true } = {}) {
        const normalizedRole = normalizeServiceRole(role);
        if (normalizedRole === 'Psicologo') {
            return matchesPsychologyScope(data, ownerUid, shiftTag, profileId, data.fechaHoraSlot, 'profesionalId');
        }

        if (!data) return false;
        if (ownerUid && data?.profesionalId && data.profesionalId !== ownerUid) return false;
        if (!ownerUid) return true;
        if (!data?.profesionalId) return includeUnassignedMedical;

        const storedProfileId = data.profesionalProfileId || null;
        if (profileId && storedProfileId && storedProfileId !== profileId) return false;

        const effectiveShift = normalizeShiftTag(
            data.shift || data.profesionalShift,
            data.fechaHoraSlot
        );
        if (shiftTag && effectiveShift && effectiveShift !== normalizeShiftTag(shiftTag)) return false;

        return data.profesionalId === ownerUid;
    }

    function normalizeShiftProfileRole(role) {
        const raw = String(role || '').toLowerCase();
        return raw.includes('psic') ? 'psicologo' : 'medico';
    }

    function normalizeShiftProfileShift(shift) {
        const raw = String(shift || '').toLowerCase();
        return raw.includes('vesp') ? 'vespertino' : 'matutino';
    }

    function getShiftProfileDocId(role, shift) {
        return `${normalizeShiftProfileRole(role)}_${normalizeShiftProfileShift(shift)}`;
    }

    function getShiftProfileAliases(role, shift) {
        return Array.from(new Set([
            getShiftProfileDocId(role, shift),
            `${String(role || '').toLowerCase()}_${String(shift || '').toLowerCase()}`,
            `${role}_${shift}`
        ].filter(Boolean)));
    }

    function normalizeShiftProfileData(role, shift, data = {}) {
        const name = data.name || data.displayName || '';
        return {
            ...data,
            name,
            displayName: data.displayName || name,
            cedula: data.cedula || '',
            cedulaLabel: data.cedulaLabel || (data.cedula ? `CP ${data.cedula}` : ''),
            specialty: data.specialty || data.especialidad || '',
            phone: data.phone || data.telefono || '',
            email: data.email || '',
            legacyShift: data.legacyShift || (normalizeShiftProfileShift(shift) === 'vespertino' ? 'Vespertino' : 'Matutino'),
            role: data.role || normalizeShiftProfileRole(role)
        };
    }

    function getDefaultProfessionalProfile(role, shift = null) {
        const normalizedRole = normalizeServiceRole(role);
        const effectiveShift = shift || normalizeShiftTag(null, new Date()) || 'Matutino';

        if (normalizedRole === 'Médico') {
            return {
                id: getShiftProfileDocId(normalizedRole, effectiveShift),
                ...normalizeShiftProfileData(normalizedRole, effectiveShift, {
                    ...DEFAULT_MEDICAL_PROFESSIONAL,
                    role: 'medico',
                    legacyShift: effectiveShift
                })
            };
        }

        return {
            id: getShiftProfileDocId(normalizedRole, effectiveShift),
            ...normalizeShiftProfileData(normalizedRole, effectiveShift, {})
        };
    }

    function resolveProfessionalIdentity(profileData = {}, role = 'Médico', shift = null) {
        const normalizedRole = normalizeServiceRole(role);
        const fallback = getDefaultProfessionalProfile(normalizedRole, shift);
        const safe = profileData || {};
        const explicitName = safe.displayName || safe.name || '';
        const explicitSpecialty = safe.specialty || safe.especialidad || safe.tipoServicio || '';
        const explicitPhone = safe.phone || safe.telefono || safe.telefonoContacto || '';
        const explicitEmail = safe.email || safe.correo || safe.autorEmail || '';
        const explicitCedula = safe.cedula || '';
        const explicitShift = safe.legacyShift || shift || fallback.legacyShift;
        const resolved = normalizeShiftProfileData(normalizedRole, explicitShift, {
            ...fallback,
            ...safe,
            name: explicitName || fallback.name || 'Profesional',
            displayName: explicitName || fallback.displayName || fallback.name || 'Profesional',
            specialty: explicitSpecialty || fallback.specialty || (normalizedRole === 'Psicologo' ? 'Psicología' : 'Médico General U.A.G.'),
            phone: explicitPhone || fallback.phone || '',
            email: explicitEmail || fallback.email || '',
            cedula: explicitCedula || fallback.cedula || '',
            cedulaLabel: safe.cedulaLabel || (explicitCedula ? `CP ${explicitCedula}` : fallback.cedulaLabel || '')
        });

        return {
            ...resolved,
            id: safe.id || safe.profileId || fallback.id || null,
            profileId: safe.profileId || safe.id || fallback.id || null
        };
    }

    function getDefaultPrescriptionTemplateUrl() {
        return DEFAULT_PRESCRIPTION_TEMPLATE_URL;
    }

    // --- SHIFT PROFILE MANAGEMENT ---
    async function getShiftProfile(ctx, role, shift) {
        if (!role) return null;
        if (!shift && normalizeServiceRole(role) === 'Médico') {
            return getDefaultProfessionalProfile(role, normalizeShiftTag(null, new Date()));
        }
        if (!shift) return null;
        const docIds = getShiftProfileAliases(role, shift);
        try {
            const [legacySnap, ...directSnaps] = await Promise.all([
                ctx.db.collection(CONFIG_COLL).doc('staff_directory').get()
                    .catch(() => null),
                ...docIds.map((docId) => ctx.db.collection('medi-shift-profiles').doc(docId).get().catch(() => null))
            ]);

            for (const snap of directSnaps) {
                if (snap?.exists) {
                    return { id: snap.id, ...normalizeShiftProfileData(role, shift, snap.data()) };
                }
            }

            if (legacySnap?.exists) {
                const legacyData = legacySnap.data();
                for (const docId of docIds) {
                    if (legacyData[docId]) {
                        return { id: docId, ...normalizeShiftProfileData(role, shift, legacyData[docId]) };
                    }
                }
            }
        } catch (e) { console.error("Error reading shift profile:", e); }

        if (normalizeServiceRole(role) === 'Médico') {
            return getDefaultProfessionalProfile(role, shift);
        }
        return null;
    }

    async function updateShiftProfile(ctx, role, shift, profileData) {
        const docIds = getShiftProfileAliases(role, shift);
        const normalized = normalizeShiftProfileData(role, shift, {
            ...profileData,
            ownerUid: profileData?.ownerUid || ctx.auth.currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: ctx.auth.currentUser.uid
        });
        const legacyUpdate = {};
        docIds.forEach((docId) => {
            legacyUpdate[docId] = normalized;
        });

        await Promise.all([
            ...docIds.map((docId) => ctx.db.collection('medi-shift-profiles').doc(docId).set(normalized, { merge: true })),
            ctx.db.collection(CONFIG_COLL).doc('staff_directory').set(legacyUpdate, { merge: true })
        ]);

        return { id: docIds[0], ...normalized };
    }

    // [NEW] Strict Resolution for Booking (Matricula + Shift Profile)
    async function resolveProfessionalForBooking(ctx, tipo, date) {
        let targetMatricula = '';
        if (tipo === 'Médico') targetMatricula = 'atencionmedica';
        else if (tipo === 'Psicologo') targetMatricula = 'atencionpsicopedagogica';
        else return null;

        const targetShift = normalizeShiftTag(null, date);

        try {
            const shiftProfile = await getShiftProfile(ctx, tipo, targetShift);
            if (shiftProfile?.ownerUid) {
                const ownerSnap = await ctx.db.collection('usuarios').doc(shiftProfile.ownerUid).get().catch(() => null);
                const ownerData = ownerSnap?.exists ? ownerSnap.data() : {};
                return {
                    id: shiftProfile.ownerUid,
                    displayName: shiftProfile.displayName || shiftProfile.name || ownerData.displayName || (tipo === 'Médico' ? 'Atención Médica' : 'Atención Psicopedagógica'),
                    email: ownerData.email || '',
                    profileId: shiftProfile.linkedProfileId || shiftProfile.profileId || shiftProfile.id || null
                };
            }
        } catch (shiftProfileErr) {
            console.warn('[MediService] Shift profile resolution failed, using matricula fallback.', shiftProfileErr);
        }

        try {
            // A. Find Main User Account by Matricula
            const q = await ctx.db.collection('usuarios').where('matricula', '==', targetMatricula).limit(1).get();
            if (q.empty) {
                console.warn(`[MediService] Alert: No account found for matricula: ${targetMatricula}`);
                return null;
            }

            const mainUserDoc = q.docs[0];
            const mainUserData = mainUserDoc.data();
            const mainUid = mainUserDoc.id;

            // Base Result (Account Owner)
            let result = {
                id: mainUid,
                displayName: mainUserData.displayName || (tipo === 'Médico' ? 'Atención Médica' : 'Atención Psicopedagógica'),
                email: mainUserData.email,
                profileId: null
            };

            // B. If Psicologo, find specific Profile based on Time
            // NOTE: usuarios/{uid}/profiles requires isOwner || isSuperAdmin in Firestore rules.
            // Students don't have that permission, so this read is wrapped in its own try-catch
            // to avoid nullifying the entire result (mainUid is still valid for booking).
            if (tipo === 'Psicologo') {
                const hour = date.getHours();
                // Logic: Matutino until 15:00, Vespertino after 15:00
                const targetShift = hour < 15 ? 'Matutino' : 'Vespertino';

                try {
                    const profilesSnap = await ctx.db.collection('usuarios').doc(mainUid).collection('profiles').get();
                    if (!profilesSnap.empty) {
                        const match = profilesSnap.docs.find(d => d.data().legacyShift === targetShift);
                        if (match) {
                            const pData = match.data();
                            result.profileId = match.id;
                            result.displayName = pData.shortName || pData.displayName || result.displayName;
                            console.log(`[MediService] Resolved Profile for Booking: ${result.displayName} (${targetShift})`);
                        }
                    }
                } catch (profileErr) {
                    // Student callers can't read the profiles subcollection (Firestore rules).
                    // Gracefully continue — the appointment will use mainUid without a specific profileId.
                    console.warn('[MediService] Could not read psicólogo profiles (expected for student callers):', profileErr.code);
                }
            }

            return result;

        } catch (e) {
            console.error("[MediService] Error resolving professional:", e);
            return null;
        }
    }

    // --- PUBLIC METHODS ---

    async function checkActiveAppointment(ctx, studentId) {
        // Blocking appointment for booking UI:
        // only confirmed / in-progress appointments should prevent a new booking.
        // Pending appointments can still be managed from "Mis Citas".

        try {
            const q = await ctx.db.collection(C_CITAS)
                .where('studentId', '==', studentId)
                .where('estado', 'in', ['confirmada', 'en_proceso'])
                .get();

            if (q.empty) return null;

            const docs = q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot)
            }));

            const now = new Date();
            const upcoming = docs
                .filter((item) => item.safeDate && item.safeDate >= now)
                .sort((a, b) => a.safeDate - b.safeDate);
            if (upcoming.length > 0) return upcoming[0];

            const datedPast = docs
                .filter((item) => item.safeDate)
                .sort((a, b) => b.safeDate - a.safeDate);
            return datedPast[0] || docs[0];
        } catch (e) {
            console.error("Error checking active appointment:", e);
            return null; // Fail safe
        }
    }

    // [REFACTORED] getOccupiedSlots — ahora devuelve info de cola por slot
    // Retorna: { occupiedSlots: string[], slotCounts: { [slotId]: number } }
    // Un slot está BLOQUEADO (ocupado) si tiene >= MAX_CITAS_PER_SLOT citas activas
    // Un slot está EN COLA si tiene >= 1 pero < MAX_CITAS_PER_SLOT citas activas
    async function getOccupiedSlots(ctx, date, tipo) {
        const looksLikeServiceType = (value) => {
            const normalized = String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
            return normalized.includes('psic') || normalized.includes('med');
        };
        if (looksLikeServiceType(date) && !looksLikeServiceType(tipo)) {
            const temp = date;
            date = tipo;
            tipo = temp;
        }
        const normalizedDate = safeDate(date);
        if (normalizedDate) {
            date = toISO(normalizedDate);
        }
        // [FIX] Auto-correct inverted arguments passed by UI (role, date instead of date, role)
        if (date && (date === 'Médico' || date === 'Psicologo' || date === 'Medico' || !date.includes('-'))) {
            const temp = date;
            date = tipo;
            tipo = temp;
        }

        // [FIX] timezone parse bug. Add 'T12:00:00' so new Date is correct local timezone.
        const safeDateStr = date.includes('T') ? date : date + 'T12:00:00';
        const start = new Date(safeDateStr); start.setHours(0, 0, 0, 0);
        const end = new Date(safeDateStr); end.setHours(23, 59, 59, 999);

        let query = ctx.db.collection(C_CITAS)
            .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(start))
            .where('fechaHoraSlot', '<=', firebase.firestore.Timestamp.fromDate(end))
            .where('estado', 'in', ['pendiente', 'confirmada']);

        if (tipo) {
            query = query.where('tipoServicio', '==', tipo);
        }

        const q = await query.get();

        // Contar citas por slotId normalizado
        const slotCounts = {};
        const occupiedSlots = [];

        q.docs.forEach(d => {
            const data = d.data();
            let sid = data.slotId;
            if (!sid) return;

            // Normalizar IDs legacy
            if (tipo && !sid.endsWith(`_${tipo}`) && !sid.includes('_Médico') && !sid.includes('_Psicologo')) {
                sid = `${sid}_${tipo}`;
            } else if (tipo && sid.endsWith(`_${tipo}`)) {
                // ya tiene el sufijo correcto
            }

            slotCounts[sid] = (slotCounts[sid] || 0) + 1;
        });

        // Slots bloqueados = los que ya tienen MAX_CITAS_PER_SLOT o más
        Object.entries(slotCounts).forEach(([sid, count]) => {
            if (count >= MAX_CITAS_PER_SLOT) {
                occupiedSlots.push(sid);
            }
        });

        // Para compatibilidad con UI existente, retornamos los occupiedSlots como array
        // PERO también adjuntamos slotCounts para que la UI pueda mostrar info de cola
        const result = occupiedSlots;
        result._slotCounts = slotCounts; // Meta-data adjunta al array
        return result;
    }

    // [REFACTORED] reservarCita — Sistema de Cola (sin slot-locking)
    // Primera cita a un horario → confirmada (auto-agendada)
    // Siguientes → pendiente (cola de espera)
    // Máximo MAX_CITAS_PER_SLOT por horario
    async function reservarCita(ctx, { user, date, slotId, tipo, motivo, replaceCitaId, profesionalId, profesionalName, profesionalProfileId, extraData }) {
        const h = date.getHours();
        const computedShift = h < 15 ? 'Matutino' : 'Vespertino';

        console.log(`[MediService] Reservando cita para ${user.email} (${tipo}) — Sistema de Cola`);

        // 1. Contar citas activas a esa hora+tipo (fuera de transacción para evitar conflictos de índice)
        const slotStart = new Date(date);
        slotStart.setSeconds(0, 0);
        const slotEnd = new Date(slotStart.getTime() + 60000); // +1 min para rango exacto

        const existingQuery = await ctx.db.collection(C_CITAS)
            .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(slotStart))
            .where('fechaHoraSlot', '<', firebase.firestore.Timestamp.fromDate(slotEnd))
            .where('estado', 'in', ['pendiente', 'confirmada'])
            .where('tipoServicio', '==', tipo)
            .get();

        const totalActivas = existingQuery.size;

        // 2. Verificar límite
        if (totalActivas >= MAX_CITAS_PER_SLOT) {
            throw new Error('Este horario ya alcanzó el límite de reservas. Por favor selecciona otro horario.');
        }

        // 3. ¿Hay una confirmada a esa hora? Si no, esta será la auto-agendada
        const hasConfirmed = existingQuery.docs.some(d => d.data().estado === 'confirmada');
        const isAutoAgendada = !hasConfirmed;
        const queuePosition = isAutoAgendada ? 0 : totalActivas; // 0 = agendada, 1-3 = cola

        // 4. Resolver profesional si se va a auto-agendar
        let resolvedProfesional = null;
        if (isAutoAgendada) {
            resolvedProfesional = await resolveProfessionalForBooking(ctx, tipo, date);
        }

        // 5. Si reemplaza una cita anterior, prepararla para cancelar de forma atomica
        let replacedAppointment = null;
        let oldRef = null;
        if (replaceCitaId) {
            oldRef = ctx.db.collection(C_CITAS).doc(replaceCitaId);
            const oldSnap = await oldRef.get();
            if (oldSnap.exists) {
                replacedAppointment = { id: oldSnap.id, ...oldSnap.data() };
            }
        }

        // 6. Crear la nueva cita con re-verificación atómica
        // NOTA: Firestore web SDK no soporta queries con 'in' dentro de transacciones.
        // Usamos una re-verificación antes de crear para minimizar race conditions.
        const ref = ctx.db.collection(C_CITAS).doc();
        // [FIX] Auto-agendar (confirmar) la primera cita del horario para que el profesional siempre la vea en su agenda
        const finalEstado = isAutoAgendada ? 'confirmada' : 'pendiente';

        const citaData = {
            studentId: user.uid,
            studentEmail: user.email,
            studentName: user.displayName || user.email,
            fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
            fechaHoraSlot: firebase.firestore.Timestamp.fromDate(date),
            slotId: slotId,
            tipoServicio: tipo,
            motivo: motivo,
            shift: computedShift,
            profesionalShift: computedShift, // Added for dashboard filtering
            estado: finalEstado,
            autoAgendada: finalEstado === 'confirmada',
            queuePosition: queuePosition,
            profesionalId: finalEstado === 'confirmada' ? (resolvedProfesional?.id || profesionalId || null) : (profesionalId || null),
            profesionalName: finalEstado === 'confirmada' ? (resolvedProfesional?.displayName || profesionalName || null) : (profesionalName || null),
            profesionalProfileId: finalEstado === 'confirmada' ? (resolvedProfesional?.profileId || profesionalProfileId || null) : (profesionalProfileId || null),
            ...(extraData && typeof extraData === 'object' ? extraData : {})
        };

        // Re-verificar disponibilidad justo antes de crear (reduce ventana de race condition)
        const recheck = await ctx.db.collection(C_CITAS)
            .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(slotStart))
            .where('fechaHoraSlot', '<', firebase.firestore.Timestamp.fromDate(slotEnd))
            .where('estado', 'in', ['pendiente', 'confirmada'])
            .where('tipoServicio', '==', tipo)
            .get();
        if (recheck.size >= MAX_CITAS_PER_SLOT) {
            throw new Error('Este horario ya alcanzó el límite de reservas. Por favor selecciona otro horario.');
        }

        const batch = ctx.db.batch();
        batch.set(ref, citaData);
        if (oldRef && replacedAppointment) {
            batch.update(oldRef, {
                estado: 'cancelada',
                motivoCancelacion: 'Re-agendada por usuario',
                fechaCancelacion: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();

        if (replacedAppointment?.estado === 'confirmada' && replacedAppointment.fechaHoraSlot && replacedAppointment.tipoServicio) {
            const oldDate = safeDate(replacedAppointment.fechaHoraSlot);
            const movedToSameSlot = oldDate
                && oldDate.getTime() === date.getTime()
                && replacedAppointment.tipoServicio === tipo;
            if (!movedToSameSlot) {
                await promoteNextInQueue(ctx, replacedAppointment.fechaHoraSlot, replacedAppointment.tipoServicio);
            }
        }


        return { citaId: ref.id, isQueued: !isAutoAgendada, queuePosition: queuePosition };
    }

    // [REMOVED] Legacy reservarCitaAdmin without profileData — see refactored version at line ~637

    async function modificarCita(ctx, citaId, { date, slotId, tipo, motivo }) {
        return ctx.db.runTransaction(async tx => {
            const citaRef = ctx.db.collection(C_CITAS).doc(citaId);
            const citaSnap = await tx.get(citaRef);
            if (!citaSnap.exists) throw new Error("La cita no existe.");
            const oldData = citaSnap.data();

            if (oldData.slotId !== slotId) {
                const oldSlotRef = ctx.db.collection(SLOTS_COLL).doc(oldData.slotId);
                const newSlotRef = ctx.db.collection(SLOTS_COLL).doc(slotId);
                const newSlotSnap = await tx.get(newSlotRef);
                if (newSlotSnap.exists) throw new Error("El nuevo horario ya está ocupado.");

                tx.delete(oldSlotRef);
                tx.set(newSlotRef, { holder: oldData.studentId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            }

            tx.update(citaRef, {
                fechaHoraSlot: firebase.firestore.Timestamp.fromDate(date),
                slotId: slotId,
                tipoServicio: tipo,
                motivo: motivo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    }


    async function modificarCita(ctx, citaId, { date, slotId, tipo, motivo, profesionalId = null, profesionalName = null, profesionalProfileId = null }) {
        const citaRef = ctx.db.collection(C_CITAS).doc(citaId);
        const citaSnap = await citaRef.get();
        if (!citaSnap.exists) throw new Error("La cita no existe.");

        const oldData = citaSnap.data();
        const nextDate = safeDate(date);
        if (!nextDate || Number.isNaN(nextDate.getTime())) {
            throw new Error("La nueva fecha no es valida.");
        }

        const nextTipo = normalizeServiceRole(tipo || oldData.tipoServicio);
        const nextSlotId = slotId || `${slotIdFromDate(nextDate)}_${nextTipo}`;
        const nextShift = normalizeShiftTag(oldData.shift, nextDate);
        const previousDate = safeDate(oldData.fechaHoraSlot);
        const changedSlot = oldData.slotId !== nextSlotId
            || oldData.tipoServicio !== nextTipo
            || !previousDate
            || previousDate.getTime() !== nextDate.getTime();

        const slotStart = new Date(nextDate);
        slotStart.setSeconds(0, 0);
        const slotEnd = new Date(slotStart.getTime() + 60000);

        const existingQuery = await ctx.db.collection(C_CITAS)
            .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(slotStart))
            .where('fechaHoraSlot', '<', firebase.firestore.Timestamp.fromDate(slotEnd))
            .where('estado', 'in', ['pendiente', 'confirmada'])
            .where('tipoServicio', '==', nextTipo)
            .get();

        const otherActive = existingQuery.docs.filter((doc) => doc.id !== citaId);
        if (otherActive.length >= MAX_CITAS_PER_SLOT) {
            throw new Error("El nuevo horario ya alcanzo el limite de citas activas.");
        }

        let resolvedProfesional = null;
        try {
            resolvedProfesional = await resolveProfessionalForBooking(ctx, nextTipo, nextDate);
        } catch (e) {
            console.warn("[MediService] No se pudo resolver el profesional al reagendar:", e);
        }

        const hasConfirmed = otherActive.some((doc) => doc.data().estado === 'confirmada');
        const finalEstado = hasConfirmed ? 'pendiente' : 'confirmada';
        const queuePosition = finalEstado === 'pendiente' ? otherActive.length : 0;

        await citaRef.update({
            fechaHoraSlot: firebase.firestore.Timestamp.fromDate(nextDate),
            slotId: nextSlotId,
            tipoServicio: nextTipo,
            motivo: motivo ?? oldData.motivo ?? '',
            shift: nextShift,
            profesionalShift: nextShift,
            estado: finalEstado,
            autoAgendada: finalEstado === 'confirmada',
            queuePosition,
            promovidaDeCola: false,
            profesionalId: resolvedProfesional?.id || profesionalId || oldData.profesionalId || null,
            profesionalName: resolvedProfesional?.displayName || profesionalName || oldData.profesionalName || null,
            profesionalProfileId: resolvedProfesional?.profileId || profesionalProfileId || oldData.profesionalProfileId || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (changedSlot && oldData.estado === 'confirmada' && oldData.fechaHoraSlot && oldData.tipoServicio) {
            await promoteNextInQueue(ctx, oldData.fechaHoraSlot, oldData.tipoServicio);
        }

        return {
            finalStatus: finalEstado,
            isQueued: finalEstado === 'pendiente',
            queuePosition
        };
    }

    async function cancelarCitaEstudiante(ctx, citaId, motivo) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const snap = await ref.get();
        if (!snap.exists) return;
        const data = snap.data();

        // Legacy: limpiar slot si existe
        if (data.slotId) {
            await ctx.db.collection(SLOTS_COLL).doc(data.slotId).delete().catch(() => { });
        }

        const wasConfirmed = data.estado === 'confirmada';

        await ref.update({
            estado: 'cancelada',
            motivoCancelacion: motivo || "Cancelada por el estudiante",
            fechaCancelacion: firebase.firestore.FieldValue.serverTimestamp()
        });

        // [NEW] Si la cita cancelada era confirmada (agendada), promover la siguiente en cola
        if (wasConfirmed && data.fechaHoraSlot && data.tipoServicio) {
            await promoteNextInQueue(ctx, data.fechaHoraSlot, data.tipoServicio);
        }
    }

    function streamStudentHistory(ctx, uid, callback) {
        // Citas: Eliminamos orderBy para evitar el error de índice compuesto
        const unsubCitas = ctx.db.collection(C_CITAS)
            .where('studentId', '==', uid)
            .onSnapshot(snap => {
                console.log(`[MediService] Stream Citas Update: ${snap.size} docs found for ${uid}`);
                const citas = snap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        tipoServicio: data.tipoServicio ? normalizeServiceRole(data.tipoServicio) : '',
                        safeDate: safeDate(data.fechaHoraSlot)
                    };
                });

                // Ordenamos manualmente por fecha descendente en el cliente
                citas.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));

                callback({ type: 'citas', data: citas.slice(0, 50) });
            }, err => console.error("Error stream Citas:", err));

        // Expedientes - CORRECCIÓN: Apuntar a la subcolección 'consultas'
        // Estructura: expedientes-clinicos/{uid}/consultas/{consultaId}
        const unsubExp = ctx.db.collection(C_EXP).doc(uid).collection('consultas')
            .orderBy('createdAt', 'desc') // Ahora sí podemos usar orderBy porque es una colección simple por usuario
            .onSnapshot(snap => {
                const exps = snap.docs.map(d => {
                    const data = d.data();
                    const cleanData = { ...data };
                    delete cleanData.notasPrivadas;
                    return {
                        id: d.id,
                        ...cleanData,
                        tipoServicio: cleanData.tipoServicio ? normalizeServiceRole(cleanData.tipoServicio) : '',
                        safeDate: safeDate(cleanData.createdAt)
                    };
                });
                // Orden ya viene del query
                callback({ type: 'expedientes', data: exps });
            }, err => {
                console.error("Error stream Expedientes:", err);
                // Fallback a array vacío si falla (ej. permisos o no existe)
                callback({ type: 'expedientes', data: [] });
            });

        return () => { unsubCitas(); unsubExp(); };
    }

    function streamSalaEspera(ctx, role, shiftTag, callback) {
        const normalizedRole = normalizeServiceRole(role);
        console.log(`[MediService] Abriendo Sala de Espera para area: ${normalizedRole} [Shift: ${shiftTag || 'All'}]`);

        // Base Query
        let ref = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'pendiente')
            .where('tipoServicio', '==', normalizedRole);

        return ref.onSnapshot(snap => {
            let docs = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot)
            }));

            // CLIENT-SIDE FILTER FOR SHIFT (If applicable)
            // Logic: 
            // - If Medical General: No shift filter needed usually (unless they want it).
            // - If Psicologo: 
            //    - If appointment has 'targetShift', match it.
            //    - If not, maybe show to both? Or just use time of day? 
            //    - Current Plan: We filter by TIME of the slot to auto-assign to morning/evening queue visually if not explicitly tagged?
            //    - BETTER: We show ALL pending to both, but when TAKING it, we tag it.
            //    - OR: User asked to "Filter data". 
            //    Let's filter by time for Sala de Espera if it's Psicologo.

            if (shiftTag) {
                docs = docs.filter(d => {
                    const storedShift = normalizeShiftTag(
                        d.shift || d.profesionalShift,
                        d.safeDate
                    );
                    if (storedShift) return storedShift === normalizeShiftTag(shiftTag);

                    const h = d.safeDate ? d.safeDate.getHours() : 0;
                    if (normalizeShiftTag(shiftTag) === 'Matutino') return h < 15;
                    return h >= 15;
                });
            }

            // Ordenamos en el cliente (Descendente por fecha)
            docs.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));

            callback(docs);
        }, err => {
            console.error("❌ Error en Acceso a Citas:", err);
            if (err.code === 'permission-denied') {
                showToast("Error de permisos: No puedes leer las citas de esta área.", "danger");
            }
        });
    }

    // [REMOVED] Old streamAgenda (4 params, no profileId) — replaced by refactored version below

    // [REMOVED] Old tomarPaciente (5 params, no profileData) — replaced by refactored version below

    // ============================================
    // [NEW] SISTEMA DE COLA — Promoción y consulta
    // ============================================

    // Promueve automáticamente la siguiente cita pendiente (más antigua) en cola para un horario
    async function promoteNextInQueue(ctx, fechaHoraSlot, tipoServicio) {
        try {
            // Buscar la cita pendiente más antigua para ese horario+tipo
            const tsDate = safeDate(fechaHoraSlot);
            if (!tsDate) return null;

            const slotStart = new Date(tsDate);
            slotStart.setSeconds(0, 0);
            const slotEnd = new Date(slotStart.getTime() + 60000);

            const q = await ctx.db.collection(C_CITAS)
                .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(slotStart))
                .where('fechaHoraSlot', '<', firebase.firestore.Timestamp.fromDate(slotEnd))
                .where('estado', '==', 'pendiente')
                .where('tipoServicio', '==', tipoServicio)
                .get();

            if (q.empty) {
                console.log('[MediService] No hay citas en cola para promover.');
                return null;
            }

            // Ordenar por fechaSolicitud (más antigua primero)
            const sorted = q.docs.map(d => ({ id: d.id, ...d.data(), _safeReq: safeDate(d.data().fechaSolicitud) }))
                .sort((a, b) => (a._safeReq || 0) - (b._safeReq || 0));

            const nextInLine = sorted[0];
            const nextRef = ctx.db.collection(C_CITAS).doc(nextInLine.id);

            // Resolver profesional para asignar
            const profesional = await resolveProfessionalForBooking(ctx, tipoServicio, tsDate);

            const updateData = {
                estado: 'confirmada',
                autoAgendada: true,
                queuePosition: 0,
                promovidaDeCola: true
            };

            if (profesional) {
                updateData.profesionalId = profesional.id;
                updateData.profesionalName = profesional.displayName;
                updateData.profesionalProfileId = profesional.profileId || null;
            }

            await nextRef.update(updateData);

            // Notificar al estudiante promovido
            if (window.Notify) {
                Notify.send(nextInLine.studentId, {
                    title: '¡Tu cita ha sido agendada!',
                    message: `Se ha liberado un espacio y tu cita ha sido agendada automáticamente${profesional ? ' con ' + profesional.displayName : ''}.`,
                    type: 'medi', link: '/medi'
                });
            }

            console.log(`[MediService] Cita ${nextInLine.id} promovida a confirmada (auto-promoción de cola).`);
            return nextInLine.id;

        } catch (e) {
            console.error('[MediService] Error promoviendo cita de cola:', e);
            return null;
        }
    }

    // Obtener las citas en cola para un horario específico (para selección manual del admin)
    async function getQueueForSlot(ctx, fechaHoraSlot, tipoServicio) {
        try {
            const tsDate = safeDate(fechaHoraSlot);
            if (!tsDate) return [];

            const slotStart = new Date(tsDate);
            slotStart.setSeconds(0, 0);
            const slotEnd = new Date(slotStart.getTime() + 60000);

            const q = await ctx.db.collection(C_CITAS)
                .where('fechaHoraSlot', '>=', firebase.firestore.Timestamp.fromDate(slotStart))
                .where('fechaHoraSlot', '<', firebase.firestore.Timestamp.fromDate(slotEnd))
                .where('estado', '==', 'pendiente')
                .where('tipoServicio', '==', tipoServicio)
                .get();

            return q.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot),
                _safeReq: safeDate(d.data().fechaSolicitud)
            })).sort((a, b) => (a._safeReq || 0) - (b._safeReq || 0));
        } catch (e) {
            console.error('[MediService] Error obteniendo cola:', e);
            return [];
        }
    }

    // Promover una cita ESPECÍFICA (seleccionada por el admin) de la cola a la agenda
    async function promoteSpecificFromQueue(ctx, citaId, tipoServicio, fechaHoraSlot) {
        try {
            const ref = ctx.db.collection(C_CITAS).doc(citaId);
            const snap = await ref.get();
            if (!snap.exists) throw new Error('Cita no encontrada');
            const data = snap.data();
            if (data.estado !== 'pendiente') throw new Error('Esta cita ya no está en espera');

            const tsDate = safeDate(fechaHoraSlot || data.fechaHoraSlot);
            const profesional = await resolveProfessionalForBooking(ctx, tipoServicio || data.tipoServicio, tsDate);

            const updateData = {
                estado: 'confirmada',
                autoAgendada: false,
                queuePosition: 0,
                promovidaDeCola: true
            };

            if (profesional) {
                updateData.profesionalId = profesional.id;
                updateData.profesionalName = profesional.displayName;
                updateData.profesionalProfileId = profesional.profileId || null;
            }

            await ref.update(updateData);

            if (window.Notify) {
                Notify.send(data.studentId, {
                    title: '¡Tu cita ha sido agendada!',
                    message: `El profesional ha seleccionado tu cita de la sala de espera${profesional ? ' con ' + profesional.displayName : ''}.`,
                    type: 'medi', link: '/medi'
                });
            }

            return data;
        } catch (e) {
            console.error('[MediService] Error promoviendo cita específica:', e);
            throw e;
        }
    }

    // NUEVO: Rechazar cita (Eliminación lógica con motivo)
    async function rechazarCita(ctx, citaId, motivo) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const snap = await ref.get();
        if (!snap.exists) return;
        const data = snap.data();

        // Liberar slot
        if (data.slotId) await ctx.db.collection(SLOTS_COLL).doc(data.slotId).delete().catch(() => { });

        // 🔔 NOTIFICAR AL ESTUDIANTE
        if (window.Notify) {
            Notify.send(data.studentId, {
                title: 'Cita Rechazada',
                message: `Tu solicitud de cita ha sido rechazada. Motivo: ${motivo}`,
                type: 'medi'
            });
        }

        return ref.update({
            estado: 'rechazada',
            motivoRechazo: motivo,
            fechaAccion: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // [REFACTORED] Cancelar cita admin con soporte de promoción de cola
    async function cancelarCitaAdmin(ctx, citaId, motivo, returnToQueue = false) {
        const ref = ctx.db.collection(C_CITAS).doc(citaId);
        const snap = await ref.get();
        if (!snap.exists) return;
        const citaData = snap.data();

        const updateData = returnToQueue
            ? {
                estado: 'pendiente',
                profesionalId: null,
                profesionalEmail: null,
                reentrada: true,
                ultimoMotivo: motivo
            }
            : { estado: 'cancelada', motivoCancelacion: motivo };

        if (typeof returnToQueue === 'string') {
            updateData.shift = returnToQueue;
            updateData.estado = 'pendiente';
            updateData.profesionalId = null;
            updateData.profesionalEmail = null;
            updateData.reentrada = true;
            updateData.ultimoMotivo = motivo;
        } else if (returnToQueue === true) {
            delete updateData.shift;
        }

        // Legacy: liberar slot si se cancela definitivamente
        if (!returnToQueue) {
            if (citaData.slotId) {
                await ctx.db.collection(SLOTS_COLL).doc(citaData.slotId).delete().catch(err => console.warn("Error liberando slot:", err));
            }
        }

        // 🔔 Notificar al estudiante
        if (window.Notify) {
            const msg = returnToQueue
                ? `Tu cita ha sido devuelta a la fila de espera. Motivo: ${motivo}`
                : `Tu cita ha sido cancelada. Motivo: ${motivo}`;
            Notify.send(citaData.studentId, {
                title: returnToQueue ? 'Cita Re-programada' : 'Cita Cancelada',
                message: msg,
                type: 'medi'
            });
        }

        await ref.update(updateData);

        // [NEW] Si se cancela definitivamente una cita confirmada, promover siguiente en cola
        if (!returnToQueue && citaData.estado === 'confirmada' && citaData.fechaHoraSlot && citaData.tipoServicio) {
            await promoteNextInQueue(ctx, citaData.fechaHoraSlot, citaData.tipoServicio);
        }
    }

    // [FIX] Clean pass-through to refactored version — now forwards profileId (6th arg)
    async function getExpedienteHistory(ctx, studentId, role, profesionalId, shiftTag, profileId) {
        return getExpedienteHistoryRefactored(ctx, studentId, role, profesionalId, shiftTag, profileId);
    }

    // [REMOVED] Old getExpedienteHistoryRefactored (5 params, no profileId) + Legacy stub — replaced by refactored version below

    // [REMOVED] Old saveConsulta — replaced by profile-aware version below

    async function buscarPaciente(ctx, term) {
        const t = term.trim();
        // 1. Try by Matricula (Exact match)
        let snap = await ctx.db.collection('usuarios').where('matricula', '==', t).get();
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

        // 2. Try by Email (Exact match, lowercase)
        snap = await ctx.db.collection('usuarios').where('email', '==', t.toLowerCase()).get();
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

        // 3. Try by Name — prefix range query (avoids full-collection download)
        // Firestore lacks ILIKE, so we use >= / <= prefix matching on displayName.
        // Max 2 Firestore reads total (was 150 reads before).
        try {
            // Attempt A: as typed (handles ALL-CAPS or already-formatted input)
            snap = await ctx.db.collection('usuarios')
                .where('displayName', '>=', t)
                .where('displayName', '<=', t + '\uf8ff')
                .limit(1)
                .get();
            if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

            // Attempt B: Title Case ('juan' → 'Juan' — most common displayName format)
            const titleT = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
            if (titleT !== t) {
                snap = await ctx.db.collection('usuarios')
                    .where('displayName', '>=', titleT)
                    .where('displayName', '<=', titleT + '\uf8ff')
                    .limit(1)
                    .get();
                if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
            }
        } catch (e) { console.warn('Search error:', e); }

        return null;
    }

    function calculateAge(birthDateString) {
        if (!birthDateString) return null;
        const today = new Date();
        const birthDate = new Date(birthDateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return isNaN(age) ? null : age;
    }



    // --- PROFILE MANAGEMENT (PIN SYSTEM) ---
    async function getProfiles(ctx, uid) {
        try {
            const snap = await ctx.db.collection('usuarios').doc(uid).collection('profiles').get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error fetching profiles:", e);
            return [];
        }
    }

    async function verifyPin(ctx, uid, pin) {
        const profiles = await getProfiles(ctx, uid);
        for (const profile of profiles) {
            if (await profilePinMatches(profile, pin)) {
                if (!profile.pinHash && profile.pin) {
                    const hashedPin = await hashPinValue(pin);
                    if (hashedPin) {
                        ctx.db.collection('usuarios').doc(uid).collection('profiles').doc(profile.id).set({
                            pinHash: hashedPin,
                            pin: firebase.firestore.FieldValue.delete(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true }).catch(() => { });
                    }
                }
                return profile;
            }
        }
        return null;
    }

    // Self-seeding for development/migration
    async function seedInitialProfiles(ctx, uid) {
        const profilesRef = ctx.db.collection('usuarios').doc(uid).collection('profiles');
        const snap = await profilesRef.get();

        if (snap.empty) {
            console.log("Seeding initial profiles for:", uid);
            const batch = ctx.db.batch();
            const pinMatutinoHash = await hashPinValue('2024');
            const pinVespertinoHash = await hashPinValue('2025');

            // Profile 1: Matutino
            const p1Ref = profilesRef.doc();
            batch.set(p1Ref, {
                displayName: "Psic. Edrey Ruiz",
                shortName: "Edrey",
                cedula: "12345678",
                ...(pinMatutinoHash ? { pinHash: pinMatutinoHash } : { pin: "2024" }),
                legacyShift: "Matutino",
                role: "psicologo",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Profile 2: Vespertino
            const p2Ref = profilesRef.doc();
            batch.set(p2Ref, {
                displayName: "Psic. Carmen Espinoza",
                shortName: "Carmen",
                cedula: "87654321",
                ...(pinVespertinoHash ? { pinHash: pinVespertinoHash } : { pin: "2025" }),
                legacyShift: "Vespertino",
                role: "psicologo",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();
            return true;
        }
        return false;
    }

    async function updateProfilePin(ctx, uid, profileId, currentPin, newPin) {
        const normalizedCurrentPin = normalizePinInput(currentPin);
        const normalizedNewPin = normalizePinInput(newPin);

        if (!uid || !profileId) throw new Error('Perfil de acceso no valido.');
        if (!normalizedCurrentPin) throw new Error('Ingresa tu PIN actual.');
        if (normalizedNewPin.length < 4) throw new Error('El nuevo PIN debe tener al menos 4 caracteres.');
        if (normalizedNewPin === normalizedCurrentPin) throw new Error('El nuevo PIN debe ser diferente al actual.');

        const profileRef = ctx.db.collection('usuarios').doc(uid).collection('profiles').doc(profileId);
        const profileSnap = await profileRef.get();
        if (!profileSnap.exists) throw new Error('No se encontro el perfil a actualizar.');

        const profileData = profileSnap.data() || {};
        const isValidCurrentPin = await profilePinMatches(profileData, normalizedCurrentPin);
        if (!isValidCurrentPin) throw new Error('El PIN actual no es correcto.');

        const hashedNewPin = await hashPinValue(normalizedNewPin);
        const updateData = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            pinLastChangedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (hashedNewPin) {
            updateData.pinHash = hashedNewPin;
            updateData.pin = firebase.firestore.FieldValue.delete();
        } else {
            updateData.pin = normalizedNewPin;
        }

        await profileRef.set(updateData, { merge: true });
        return true;
    }

    function buildPrivateConsultaScopeMeta(meta = {}) {
        return {
            autorId: meta.autorId || meta.ownerUid || null,
            profesionalProfileId: meta.profesionalProfileId || meta.profileId || null,
            shift: meta.shift || meta.profesionalShift || null,
            tipoServicio: meta.tipoServicio || null,
            createdAt: meta.createdAt || meta.updatedAt || null
        };
    }

    function canReadPrivateConsultaNote(noteData = {}, scope = null, consultationMeta = null) {
        if (!scope) return true;

        const noteScopeMeta = buildPrivateConsultaScopeMeta(noteData);
        const hasNoteScope = !!(noteScopeMeta.autorId || noteScopeMeta.profesionalProfileId || noteScopeMeta.shift || noteScopeMeta.tipoServicio);
        if (hasNoteScope) {
            return matchesConsultationScope(noteScopeMeta, scope.role, scope.ownerUid, scope.shift, scope.profileId);
        }

        const fallbackMeta = buildPrivateConsultaScopeMeta(consultationMeta || {});
        const hasFallbackScope = !!(fallbackMeta.autorId || fallbackMeta.profesionalProfileId || fallbackMeta.shift || fallbackMeta.tipoServicio);
        if (!hasFallbackScope) return true;

        return matchesConsultationScope(fallbackMeta, scope.role, scope.ownerUid, scope.shift, scope.profileId);
    }

    async function getPrivateConsultaNote(ctx, studentId, consultaId, scope = null, consultationMeta = null) {
        if (!studentId || !consultaId) return '';
        try {
            const privateRef = ctx.db.collection(C_EXP)
                .doc(studentId)
                .collection(C_PRIVATE_CONSULTAS)
                .doc(consultaId);
            const snap = await privateRef.get();

            if (!snap.exists) return '';
            const data = snap.data() || {};
            if (!canReadPrivateConsultaNote(data, scope, consultationMeta)) return '';

            const note = String(data.note || '').trim();
            const currentMeta = buildPrivateConsultaScopeMeta(data);
            const fallbackMeta = buildPrivateConsultaScopeMeta(consultationMeta || {});
            const needsBackfill = note && consultationMeta
                && !(currentMeta.autorId || currentMeta.profesionalProfileId || currentMeta.shift || currentMeta.tipoServicio)
                && (fallbackMeta.autorId || fallbackMeta.profesionalProfileId || fallbackMeta.shift || fallbackMeta.tipoServicio);

            if (needsBackfill) {
                privateRef.set({
                    ...fallbackMeta,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(() => { });
            }

            return note;
        } catch (e) {
            console.warn('[MediService] Error reading private consultation note:', e);
            return '';
        }
    }

    async function migrateLegacyPrivateConsultaNote(ctx, studentId, consultaId, rawNote, meta = null) {
        const note = String(rawNote || '').trim();
        if (!studentId || !consultaId || !note) return false;

        try {
            const expedienteRef = ctx.db.collection(C_EXP).doc(studentId);
            const privateRef = expedienteRef.collection(C_PRIVATE_CONSULTAS).doc(consultaId);
            const consultaRef = expedienteRef.collection('consultas').doc(consultaId);
            let effectiveMeta = meta;

            if (!effectiveMeta) {
                const consultaSnap = await consultaRef.get().catch(() => null);
                if (consultaSnap?.exists) effectiveMeta = consultaSnap.data() || null;
            }

            await privateRef.set({
                note,
                migratedFromLegacy: true,
                ...buildPrivateConsultaScopeMeta(effectiveMeta || {}),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await consultaRef.update({
                hasPrivateNotes: true,
                notasPrivadas: firebase.firestore.FieldValue.delete(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => { });

            return true;
        } catch (e) {
            console.warn('[MediService] Error migrating private consultation note:', e);
            return false;
        }
    }


    // [NEW] Check Slot Conflict Internal
    async function checkSlotConflict(ctx, date, tipoServicio) {
        // Check confirmed appointments at this exact time
        let q = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'confirmada')
            .where('fechaHoraSlot', '==', date);

        if (tipoServicio) {
            q = q.where('tipoServicio', '==', tipoServicio);
        }

        const snap = await q.get();
        return !snap.empty;
    }

    // [REMOVED] Duplicate getOccupiedSlots override (caused logic bug where queue status was always 0)

    // --- PUBLIC METHODS (UPDATED) ---



    // --- PUBLIC METHODS (UPDATED) ---

    // Updated to accept profile info
    async function tomarPaciente(ctx, citaId, profesionalId, profesionalEmail, shiftTag, profileData = null) {
        return ctx.db.runTransaction(async (tx) => {
            const ref = ctx.db.collection(C_CITAS).doc(citaId);
            const snap = await tx.get(ref);

            if (!snap.exists) throw new Error("Cita no encontrada");
            const cita = snap.data();

            if (cita.estado !== 'pendiente') {
                throw new Error("Esta cita ya no está disponible.");
            }

            // Validar conflicto horario (DOBLE VERIFICACION)
            // Aunque getOccupiedSlots lo usa el UI, el backend debe protegerse
            const isOccupied = await checkSlotConflict(ctx, cita.fechaHoraSlot, cita.tipoServicio);
            if (isOccupied) throw new Error("Este horario ya fue ocupado por otra persona.");

            // Validar conflicto horario
            const conflictQuery = ctx.db.collection(C_CITAS)
                .where('profesionalId', '==', profesionalId) // This is Auth UID
                .where('estado', '==', 'confirmada')
                .where('fechaHoraSlot', '==', cita.fechaHoraSlot);

            const conflictSnap = await conflictQuery.get();

            if (!conflictSnap.empty) {
                // Si es el mismo usuario pero diferente perfil, technically conflict?
                // For now, simple check on UID.
                throw new Error('Ya tienes cita a esa hora.');
            }

            const updateData = {
                estado: 'confirmada',
                profesionalId: profesionalId, // Auth UID
                profesionalEmail: profesionalEmail,
                profesionalShift: shiftTag || null, // Legacy Shift or Profile Shift
                profesionalName: profileData?.displayName || ctx.profile?.displayName || profesionalEmail || null,
                profesionalCedula: profileData?.cedula || ctx.profile?.cedula || null
            };

            // NEW: Add Profile Info if available
            if (profileData) {
                updateData.profesionalProfileId = profileData.id;
            }

            tx.update(ref, updateData);

            // 🔔 NOTIFICAR AL ESTUDIANTE
            if (window.Notify) {
                Notify.send(cita.studentId, {
                    title: 'Cita Confirmada',
                    message: `Tu cita ha sido confirmada con ${profileData ? profileData.displayName : (profesionalEmail || 'un especialista')}.`,
                    type: 'medi',
                    link: '/medi'
                });
            }

            return cita;
        });
    }

    async function reservarCitaAdmin(ctx, { student, date, slotId, tipo, motivo, shift, profileData }) {
        const normalizedTipo = normalizeServiceRole(tipo);
        const normalizedShift = normalizeShiftTag(shift, date);
        let operationalProfessional = null;

        if (profileData) {
            operationalProfessional = {
                id: profileData.ownerUid || ctx.auth.currentUser.uid,
                displayName: profileData.displayName || profileData.name || ctx.profile?.displayName || ctx.auth.currentUser.email || 'Profesional',
                email: ctx.auth.currentUser.email || '',
                profileId: profileData.linkedProfileId || profileData.id || null,
                cedula: profileData.cedula || ctx.profile?.cedula || ''
            };
        }

        if (!operationalProfessional) {
            operationalProfessional = await resolveProfessionalForBooking(ctx, normalizedTipo, date).catch(() => null);
        }

        if (!operationalProfessional && normalizedShift) {
            const shiftProfile = await getShiftProfile(ctx, normalizedTipo, normalizedShift).catch(() => null);
            if (shiftProfile) {
                operationalProfessional = {
                    id: shiftProfile.ownerUid || ctx.auth.currentUser.uid,
                    displayName: shiftProfile.displayName || shiftProfile.name || ctx.profile?.displayName || ctx.auth.currentUser.email || 'Profesional',
                    email: ctx.auth.currentUser.email || '',
                    profileId: shiftProfile.linkedProfileId || shiftProfile.profileId || shiftProfile.id || null,
                    cedula: shiftProfile.cedula || ctx.profile?.cedula || ''
                };
            }
        }

        operationalProfessional = operationalProfessional || {
            id: ctx.auth.currentUser.uid,
            displayName: ctx.profile?.displayName || ctx.auth.currentUser.email || 'Profesional',
            email: ctx.auth.currentUser.email || '',
            profileId: profileData?.id || null,
            cedula: profileData?.cedula || ctx.profile?.cedula || ''
        };

        return ctx.db.runTransaction(async tx => {
            const slotRef = ctx.db.collection(SLOTS_COLL).doc(slotId);
            const slotSnap = await tx.get(slotRef);
            if (slotSnap.exists) throw new Error("El horario seleccionado ya no está disponible.");

            tx.set(slotRef, { holder: student.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

            const newCitaRef = ctx.db.collection(C_CITAS).doc();
            const docData = {
                studentId: student.uid,
                studentEmail: student.email,
                studentName: student.displayName || student.email,
                fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp(),
                fechaHoraSlot: firebase.firestore.Timestamp.fromDate(date),
                slotId: slotId,
                tipoServicio: normalizedTipo,
                motivo: motivo,
                estado: 'confirmada',
                profesionalId: operationalProfessional.id,
                profesionalEmail: operationalProfessional.email || '',
                profesionalName: operationalProfessional.displayName,
                profesionalCedula: operationalProfessional.cedula || '',
                profesionalShift: normalizedShift,
                shift: normalizedShift
            };

            if (operationalProfessional.profileId) {
                docData.profesionalProfileId = operationalProfessional.profileId;
                docData.profesionalName = operationalProfessional.displayName;
            }

            tx.set(newCitaRef, docData);
        });
    }

    // Refactor streamAgenda to support Profile ID filtering and Role filtering
    function streamAgenda(ctx, role, profesionalId, shiftTag, profileId, callback) {
        const normalizedRole = normalizeServiceRole(role);
        let ref = ctx.db.collection(C_CITAS)
            .where('tipoServicio', '==', normalizedRole)
            .where('estado', '==', 'confirmada');

        return ref.onSnapshot(snap => {
            let docs = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                safeDate: safeDate(d.data().fechaHoraSlot)
            }));

            // Filter logic based on Role
            if (normalizedRole === 'Médico') {
                // Médico sees ALL confirmed médico appointments, regardless of who picked them up
                // No extra filtering needed
            } else if (normalizedRole === 'Psicologo') {
                // Psicologo sees ONLY confirmed psicologo appointments matching their shift
                docs = docs.filter(d => {
                    const shiftToCheck = d.shift || d.profesionalShift;
                    if (shiftToCheck && shiftTag) {
                        return shiftToCheck === shiftTag;
                    }

                    // Fallback to time-based filtering if it has no shift assigned
                    const h = d.safeDate ? d.safeDate.getHours() : 0;
                    if (shiftTag === 'Matutino') return h < 15;
                    return h >= 15;
                });
            }

            docs = docs.filter(d => matchesAppointmentScope(d, normalizedRole, profesionalId, shiftTag, profileId));
            docs.sort((a, b) => (a.safeDate || 0) - (b.safeDate || 0));
            callback(docs);
        }, err => {
            console.error("❌ Error en Stream Agenda:", err);
            if (err.code === 'permission-denied') {
                if (window.showToast) showToast("Error de permisos: No puedes leer las citas agendadas.", "danger");
            } else if (err.code === 'failed-precondition') {
                console.warn("Falta Índice en Firestore para Citas confirmadas.");
                if (window.showToast) showToast("Error de Base de Datos (Falta Índice). Revisa la consola.", "danger");
            }
        });
    }

    // Refactor getExpedienteHistory to support Profile ID
    async function getExpedienteHistoryRefactored(ctx, studentId, role, profesionalId, shiftTag, profileId) {
        let docs = [];

        // 1. LEGACY: Colección Plana 'expedientes-clinicos'
        if (role === 'Médico') {
            const legacyMedSnap = await ctx.db.collection(C_EXP)
                .where('studentId', '==', studentId)
                .where('tipoServicio', '==', 'Médico')
                .get();
            legacyMedSnap.forEach(d => {
                const val = d.data();
                if (matchesConsultationScope(val, role, profesionalId, shiftTag, profileId)) {
                    docs.push({ id: d.id, ...val, signos: normalizeSigns(val), safeDate: safeDate(val.createdAt), source: 'legacy' });
                }
            });
        }

        if (role === 'Psicologo') {
            const legacyPsychSnap = await ctx.db.collection(C_EXP)
                .where('studentId', '==', studentId)
                .where('tipoServicio', '==', 'Psicologico')
                .where('autorId', '==', profesionalId)
                .get();

            legacyPsychSnap.forEach(d => {
                const val = d.data();
                // Filter: If profileId matches OR if legacy shift matches
                let include = false;
                if (profileId && val.profesionalProfileId === profileId) include = true;
                else if (shiftTag && val.shift === shiftTag) include = true;
                // If it's a legacy doc without profileId but we are viewing from a profile, relying on shift is the Way.

                if (include) {
                    docs.push({ id: d.id, ...val, signos: normalizeSigns(val), safeDate: safeDate(val.createdAt), source: 'legacy' });
                }
            });
        }

        // 2. NUEVA ESTRUCTURA
        try {
            const consultasRef = ctx.db.collection(C_EXP).doc(studentId).collection('consultas');
            let newQuery = consultasRef;

            if (role === 'Médico') {
                newQuery = newQuery.where('tipoServicio', '==', 'Médico');
            } else if (role === 'Psicologo') {
                // Remove strict autorId filter to allow seeing history from same department (maybe?)
                // Or keep it strict. If strict, profiles are under same UID, so it works.
                newQuery = newQuery.where('tipoServicio', '==', 'Psicologico')
                    .where('autorId', '==', profesionalId);
            }

            const newSnap = await newQuery.get();

            newSnap.forEach(d => {
                const val = d.data();
                let include = false;

                if (role === 'Psicologo') {
                    // Logic: Show if matches Current Profile ID or if Legacy Shift matches
                    const matchesProfile = profileId && val.profesionalProfileId === profileId;
                    const matchesShift = shiftTag && val.shift === shiftTag;

                    const hasProfile = !!val.profesionalProfileId;

                    // STRICT LOGIC:
                    // 1. If the doc has a Profile ID, it MUST match the current profile (Ownership).
                    // 2. If the doc has NO Profile ID (Legacy), it MUST match the shift (Department Continuity).

                    if (hasProfile) {
                        if (matchesProfile) include = true;
                    } else {
                        if (matchesShift) include = true;
                    }

                } else {
                    include = matchesConsultationScope(val, role, profesionalId, shiftTag, profileId);
                }

                if (include) {
                    // [FIX] Filter out non-finalized consultations from History View/Sidebar
                    if (val.estado !== 'finalizada') {
                        include = false;
                    }
                }

                if (include) {
                    docs.push({ id: d.id, ...val, signos: normalizeSigns(val), safeDate: safeDate(val.createdAt), source: 'new' });
                }
            });

        } catch (e) {
            console.warn("Error leyendo nueva estructura:", e);
        }

        docs.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));

        const isHealthViewer = role === 'Médico' || role === 'Psicologo';
        docs.forEach((doc) => {
            if (doc?.source === 'new' && doc?.notasPrivadas && isHealthViewer) {
                migrateLegacyPrivateConsultaNote(ctx, studentId, doc.id, doc.notasPrivadas, doc).catch(() => { });
            }
            if (!isHealthViewer && doc?.notasPrivadas) {
                delete doc.notasPrivadas;
            }
        });

        return docs;
    }

    // Updated saveConsulta to include profile info
    async function saveConsulta(ctx, payload, citaId) {
        return ctx.db.runTransaction(async (tx) => {
            let citaRef = null;
            let cSnap = null;
            const privateNote = String(payload?.notasPrivadas || '').trim();
            const publicPayload = { ...payload };
            delete publicPayload.notasPrivadas;

            // 1. REALIZAR LECTURAS PRIMERO (Regla de Firestore Transactions)
            if (citaId && citaId !== 'null' && !citaId.startsWith('walkin_')) {
                if (payload.estado === 'finalizada') {
                    citaRef = ctx.db.collection(C_CITAS).doc(citaId);
                    cSnap = await tx.get(citaRef);
                }
            }

            // 2. REALIZAR ESCRITURAS DESPUÉS
            const masterRef = ctx.db.collection(C_EXP).doc(payload.studentId);
            const consultaRef = masterRef.collection('consultas').doc();
            const privateRef = masterRef.collection(C_PRIVATE_CONSULTAS).doc(consultaRef.id);

            const masterData = {
                studentId: payload.studentId,
                studentEmail: payload.studentEmail,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(masterRef, masterData, { merge: true });
            tx.set(consultaRef, {
                ...publicPayload,
                hasPrivateNotes: !!privateNote,
                signos: normalizeSigns(publicPayload)
            });

            if (privateNote) {
                tx.set(privateRef, {
                    note: privateNote,
                    ...buildPrivateConsultaScopeMeta(publicPayload),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            if (cSnap && cSnap.exists) {
                tx.update(citaRef, {
                    estado: 'finalizada',
                    fechaConfirmacion: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });
    }

    // [NEW] DASHBOARD HELPER (STREAM)
    function streamRecentConsultations(ctx, role, uid, profileId, limit = 5, callback, shiftTag = null) {
        try {
            console.log(`[MediService] Stream Recent Request -> Role: ${role}, UID: ${uid}, Profile: ${profileId}`);
            const effectiveUid = uid || (ctx.auth.currentUser ? ctx.auth.currentUser.uid : null);
            if (!effectiveUid) {
                console.error("[MediService] UID missing/null for streamRecentConsultations - Aborting query.");
                callback([]);
                return () => { };
            }

            const normalizedRole = normalizeServiceRole(role);
            let q = ctx.db.collectionGroup('consultas')
                .where('autorId', '==', effectiveUid);

            // Filter logic
            if (normalizedRole === 'Psicologo' && profileId) {
                // Legacy compatibility: filter later in memory so old docs without profileId are still visible.
                q = q;
            } else {
                // Legacy / General User Filtering (Médico)
                // STRICT: Must match autorId to the current user
                const effectiveUid = uid || (ctx.auth.currentUser ? ctx.auth.currentUser.uid : null);

                if (!effectiveUid) {
                    console.error("[MediService] UID missing/null for streamRecentConsultations - Aborting query.");
                    callback([]);
                    return () => { };
                }

                console.log(`[MediService] Filtering by autorId: ${effectiveUid}`);
                q = q;
            }

            // Order & Limit
            // [FIX] Filter by finalized only to hide paused/drafts from "Recent" list
            q = q.where('estado', '==', 'finalizada');
            q = q.orderBy('createdAt', 'desc').limit(Math.max(limit * 4, 20));

            const unsubscribe = q.onSnapshot(async (snap) => {
                console.log(`[MediService] Stream Recent Update: ${snap.size} docs found.`);
                const docs = [];
                // Process docs sequentially to fetch names if needed
                for (const d of snap.docs) {
                    const val = d.data();
                    if (!matchesConsultationScope(val, normalizedRole, effectiveUid, shiftTag, profileId)) continue;
                    let patientName = val.studentName || val.pacienteNombre;

                    // If name is missing, try to fetch from 'usuarios' (Optimized: In a real app we'd cache this)
                    if (!patientName && val.studentId) {
                        try {
                            const uSnap = await ctx.db.collection('usuarios').doc(val.studentId).get();
                            if (uSnap.exists) {
                                patientName = uSnap.data().displayName || uSnap.data().nombre;
                            }
                        } catch (err) { console.warn("Error fetching user name:", err); }
                    }

                    docs.push({
                        id: d.id,
                        ...val,
                        signos: normalizeSigns(val),
                        isAnonymous: typeof val.studentId === 'string' && val.studentId.startsWith('anon_'),
                        patientName: patientName || val.studentEmail || "Estudiante", // Fallback
                        safeDate: safeDate(val.createdAt)
                    });
                }
                docs.sort((a, b) => (b.safeDate || 0) - (a.safeDate || 0));
                callback(docs.slice(0, limit));
            }, (error) => {
                console.error("Error streaming recent consultations:", error);
                callback([]);
            });

            return unsubscribe; // Return unsub function

        } catch (e) {
            console.error("Error setting up stream:", e);
            callback([]);
            return () => { };
        }
    }

    // --- C1: Day Stats for Dashboard ---
    async function getDayStats(ctx, role, uid, profileId, shiftTag = null) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const normalizedRole = normalizeServiceRole(role);
        const normalizedShift = normalizeShiftTag(shiftTag);

        // 1. Consultations completed today
        let q = ctx.db.collectionGroup('consultas')
            .where('createdAt', '>=', startOfDay)
            .where('estado', '==', 'finalizada')
            .where('autorId', '==', uid);

        const snap = await q.get();
        const consultas = snap.docs
            .map(d => d.data())
            .filter((data) => matchesConsultationScope(data, normalizedRole, uid, normalizedShift, profileId));

        const totalAtendidos = consultas.length;

        // 2. Average consultation duration
        const duraciones = consultas.filter(c => c.duracionMinutos > 0).map(c => c.duracionMinutos);
        const avgDuracion = duraciones.length > 0 ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length) : 0;

        // 3. Diagnoses frequency (top 5)
        const diagMap = {};
        consultas.forEach(c => {
            if (c.diagnostico) {
                const key = c.diagnostico.trim().toLowerCase();
                diagMap[key] = (diagMap[key] || 0) + 1;
            }
        });
        const topDiagnosticos = Object.entries(diagMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([diag, count]) => ({ diagnostico: diag, count }));

        // 4. Pending appointments today (waiting room)
        let pendQ = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'pendiente');

        pendQ = pendQ.where('tipoServicio', '==', normalizedRole);

        let enEspera = 0;
        try {
            const pendSnap = await pendQ.get();
            enEspera = pendSnap.docs.filter((doc) => {
                const data = doc.data();
                const slotDate = safeDate(data.fechaHoraSlot || data.fechaSolicitud);
                return !!slotDate &&
                    slotDate >= startOfDay &&
                    matchesAppointmentScope(data, normalizedRole, uid, normalizedShift, profileId, {
                        includeUnassignedMedical: true
                    });
            }).length;
        } catch (e) { /* index may not exist */ }

        // 5. Average wait time (from fechaSolicitud to fechaConfirmacion for today's finalized citas)
        let citasQ = ctx.db.collection(C_CITAS)
            .where('estado', '==', 'finalizada')
            .where('tipoServicio', '==', normalizedRole);

        let avgEspera = 0;
        try {
            const citasSnap = await citasQ.get();
            const waits = [];
            citasSnap.docs.forEach(d => {
                const data = d.data();
                if (!matchesAppointmentScope(data, normalizedRole, uid, normalizedShift, profileId, {
                    includeUnassignedMedical: false
                })) return;
                const sol = safeDate(data.fechaSolicitud);
                const conf = safeDate(data.fechaConfirmacion);
                if (sol && conf && sol >= startOfDay) {
                    const diffMin = Math.round((conf.getTime() - sol.getTime()) / 60000);
                    if (diffMin > 0 && diffMin < 480) waits.push(diffMin);
                }
            });
            if (waits.length > 0) avgEspera = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
        } catch (e) { /* ignore */ }

        return { totalAtendidos, avgDuracion, avgEspera, enEspera, topDiagnosticos };
    }

    // --- C7: Follow-ups ---
    async function getFollowUps(ctx, role, uid, profileId, shiftTag = null) {
        const normalizedRole = normalizeServiceRole(role);
        const normalizedShift = normalizeShiftTag(shiftTag);
        let q = ctx.db.collectionGroup('consultas')
            .where('followUp.required', '==', true)
            .where('estado', '==', 'finalizada')
            .where('autorId', '==', uid);

        const snap = await q.limit(200).get();
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((data) => matchesConsultationScope(data, normalizedRole, uid, normalizedShift, profileId))
            .sort((a, b) => (safeDate(b.createdAt) || 0) - (safeDate(a.createdAt) || 0))
            .map((data) => ({
                id: data.id,
                studentId: data.studentId,
                studentEmail: data.studentEmail,
                studentName: data.studentName || data.studentEmail || 'Estudiante',
                diagnostico: data.diagnostico,
                followUpDate: data.followUp?.date || null,
                followUpNotes: data.followUp?.notes || '',
                createdAt: safeDate(data.createdAt)
            }));
    }

    async function getStudentFollowUps(ctx, studentId) {
        // Query consultas subcollection for this student
        // Note: 'consultas' are in expedientes-clinicos/{studentId}/consultas
        const ref = ctx.db.collection(C_EXP).doc(studentId).collection('consultas');
        const q = ref.where('followUp.required', '==', true)
            .where('estado', '==', 'finalizada')
            .orderBy('createdAt', 'desc')
            .limit(1);

        const snap = await q.get();
        return snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            followUpDate: d.data().followUp?.date,
            followUpNotes: d.data().followUp?.notes
        }));
    }

    async function getPatientOperationalSnapshot(ctx, studentId, scope = {}) {
        const emptySnapshot = {
            totalConsultas: 0,
            lastDiagnosis: '',
            lastConsultationDate: null,
            lastService: '',
            activeAppointments: 0,
            noShowCount: 0,
            followUp: null
        };

        if (!studentId || String(studentId).startsWith('anon_')) return emptySnapshot;

        const normalizedRole = normalizeServiceRole(scope.role);
        const ownerUid = scope.ownerUid || scope.uid || ctx.auth.currentUser?.uid || null;
        const normalizedShift = normalizeShiftTag(scope.shift);
        const profileId = scope.profileId || null;

        let history = [];
        try {
            history = await getExpedienteHistory(
                ctx,
                studentId,
                normalizedRole,
                ownerUid,
                normalizedShift,
                profileId
            );
        } catch (err) {
            console.warn('[MediService] Error loading patient operational history:', err);
        }

        const lastConsultation = history[0] || null;
        const pendingFollowUp = history.find((item) => item?.followUp?.required) || null;

        let activeAppointments = 0;
        let noShowCount = 0;
        try {
            const citasSnap = await ctx.db.collection(C_CITAS).where('studentId', '==', studentId).get();
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            citasSnap.docs.forEach((doc) => {
                const data = doc.data() || {};
                const slotDate = safeDate(data.fechaHoraSlot || data.fechaSolicitud);
                if (
                    ['pendiente', 'confirmada', 'en_proceso'].includes(data.estado)
                    && (!slotDate || slotDate >= startOfDay)
                ) {
                    activeAppointments += 1;
                }
                if (data.noShow === true || /no asist/i.test(String(data.motivoCancelacion || ''))) {
                    noShowCount += 1;
                }
            });
        } catch (err) {
            console.warn('[MediService] Error loading patient appointment snapshot:', err);
        }

        const followUpDate = safeDate(pendingFollowUp?.followUp?.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return {
            totalConsultas: history.length,
            lastDiagnosis: lastConsultation?.diagnostico || lastConsultation?.motivo || '',
            lastConsultationDate: safeDate(lastConsultation?.safeDate || lastConsultation?.createdAt),
            lastService: lastConsultation?.tipoServicio || '',
            activeAppointments,
            noShowCount,
            followUp: pendingFollowUp ? {
                date: followUpDate,
                notes: pendingFollowUp?.followUp?.notes || '',
                overdue: !!(followUpDate && followUpDate < today)
            } : null
        };
    }

    async function getPatientInsights(ctx, role, uid, profileId, shiftTag = null, limit = 6) {
        const normalizedRole = normalizeServiceRole(role);
        const normalizedShift = normalizeShiftTag(shiftTag);
        const safeLimit = Math.max(parseInt(limit, 10) || 6, 1);
        const results = { recent: [], frequent: [] };

        if (!uid) return results;

        try {
            const snap = await ctx.db.collectionGroup('consultas')
                .where('autorId', '==', uid)
                .where('estado', '==', 'finalizada')
                .orderBy('createdAt', 'desc')
                .limit(Math.max(safeLimit * 12, 48))
                .get();

            const grouped = new Map();
            const recent = [];

            snap.docs.forEach((doc) => {
                const data = doc.data() || {};
                if (!matchesConsultationScope(data, normalizedRole, uid, normalizedShift, profileId)) return;

                const studentId = data.studentId;
                if (!studentId || String(studentId).startsWith('anon_')) return;

                const item = {
                    uid: studentId,
                    displayName: data.studentName || data.patientName || data.studentEmail || 'Estudiante',
                    email: data.studentEmail || '',
                    diagnosis: data.diagnostico || data.motivo || '',
                    lastDate: safeDate(data.createdAt),
                    matricula: data.pacienteMatricula || '',
                    carrera: '',
                    totalVisits: 1
                };

                if (!grouped.has(studentId)) {
                    grouped.set(studentId, { ...item });
                    if (recent.length < safeLimit) recent.push(item);
                } else {
                    const current = grouped.get(studentId);
                    current.totalVisits += 1;
                    if (!current.lastDate || (item.lastDate && item.lastDate > current.lastDate)) {
                        current.lastDate = item.lastDate;
                        current.diagnosis = item.diagnosis;
                        current.displayName = item.displayName || current.displayName;
                    }
                }
            });

            const idsToEnrich = Array.from(grouped.keys()).slice(0, safeLimit * 2);
            const userDocs = await Promise.all(idsToEnrich.map((studentId) =>
                ctx.db.collection('usuarios').doc(studentId).get().catch(() => null)
            ));

            userDocs.forEach((snapDoc, index) => {
                if (!snapDoc?.exists) return;
                const studentId = idsToEnrich[index];
                const data = snapDoc.data() || {};
                const current = grouped.get(studentId);
                if (!current) return;
                current.displayName = data.displayName || current.displayName;
                current.email = data.email || current.email;
                current.matricula = data.matricula || current.matricula;
                current.carrera = data.carrera || current.carrera;
            });

            results.recent = recent
                .map((item) => grouped.get(item.uid) || item)
                .slice(0, safeLimit);

            results.frequent = Array.from(grouped.values())
                .sort((a, b) => {
                    if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
                    return (b.lastDate || 0) - (a.lastDate || 0);
                })
                .slice(0, safeLimit);

            return results;
        } catch (err) {
            console.warn('[MediService] Error building patient insights:', err);
            return results;
        }
    }

    return {
        loadConfig,
        updateConfig,
        getConfig,
        safeDate,
        checkActiveAppointment,
        checkActiveAppointment,
        getOccupiedSlots,
        reservarCita,
        reservarCitaAdmin,
        modificarCita,
        cancelarCitaEstudiante,
        streamStudentHistory,
        streamSalaEspera,
        streamAgenda,
        tomarPaciente,
        cancelarCitaAdmin,
        streamRecentActivity: streamRecentConsultations, // [FIX] Aliased to existing function

        saveConsulta,

        getProfiles,
        getExpedienteHistory,
        verifyPin,
        updateProfilePin,
        seedInitialProfiles,
        getPrivateConsultaNote,
        migrateLegacyPrivateConsultaNote,
        rechazarCita,
        streamRecentConsultations,
        buscarPaciente,
        getDayStats, getFollowUps, getStudentFollowUps,
        getPatientOperationalSnapshot,
        getPatientInsights,

        // Sistema de Cola (Nuevo)
        promoteNextInQueue,
        getQueueForSlot,
        promoteSpecificFromQueue,

        // Shift Profile Management (Newly Added)
        getShiftProfile,
        updateShiftProfile,
        getDefaultProfessionalProfile,
        resolveProfessionalIdentity,
        getDefaultPrescriptionTemplateUrl,
        resolveProfessionalForBooking,
        getSlotDurationForContext,
        getDisabledHoursForContext,
        getAvailabilityKeyForContext,
        getPauseUntilKeyForContext,
        getPauseUntilForContext,
        isServiceEnabledForContext,
        normalizeServiceRole,
        normalizeShiftTag,

        // Utils
        pad, toISO, slotIdFromDate, calculateAge
    };


})();
