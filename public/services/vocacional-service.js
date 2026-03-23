/**
 * vocacional-service.js
 * Servicio de Firebase Compat para el Módulo del Test Vocacional
 */

const VocacionalService = (function () {

    // Configuración DB Local a este IIFE
    const getDb = () => window.SIA?.db || window.db || firebase.firestore();
    const COLLECTION_NAME = "aspirantes-registros";

    // ==========================================
    // CATÁLOGOS ESTÁTICOS
    // ==========================================
    const VOCACIONAL_CATALOGS = {
        highSchools: [
            { id: 'cecyte_04', name: 'CECyTE 04 (San José del Cabo)', type: 'public', technicalCareers: ['Soporte y Mantenimiento de Equipo de Cómputo', 'Servicios de Hotelería', 'Ecoturismo', 'Ventas'] },
            { id: 'cecyte_05', name: 'CECyTE 05 (Cabo San Lucas)', type: 'public', technicalCareers: ['Soporte y Mantenimiento de Equipo de Cómputo', 'Ecoturismo', 'Ventas', 'Servicios de Hospedaje', 'Refrigeración y Aire Acondicionado', 'Preparación de Alimentos y Bebidas'] },
            { id: 'cecyte_07', name: 'CECyTE 07 (San José del Cabo - San Bernabé)', type: 'public', technicalCareers: ['Mantenimiento Industrial', 'Soporte y Mantenimiento de Equipo de Cómputo'] },
            { id: 'conalep_282', name: 'CONALEP Plantel 282 (SJC)', type: 'public', technicalCareers: ['Alimentos y Bebidas', 'Electromecánica Industrial', 'Enfermería General', 'Hospitalidad Turística (Turismo)', 'Administración'] },
            { id: 'cbta_256', name: 'CBTIS No. 256 (Cabo San Lucas)', type: 'public', technicalCareers: ['Técnico Agropecuario', 'Técnico en Ofimática', 'Técnico en Logística'] },
            { id: 'cetmar_31', name: 'CETMAR No. 31 (Cabo San Lucas)', type: 'public', technicalCareers: ['Refrigeración y Aire Acondicionado', 'Recreaciones Acuáticas', 'Pesca Deportiva y Buceo', 'Mecánica Naval', 'Acuacultura'] },
            { id: 'cobach_02', name: 'COBACH Plantel 02 (San José del Cabo)', type: 'public', technicalCareers: [] },
            { id: 'cobach_04', name: 'COBACH Plantel 04 (Cabo San Lucas)', type: 'public', technicalCareers: [] },
            { id: 'cobach_10', name: 'COBACH Plantel 10 (Cabo San Lucas)', type: 'public', technicalCareers: [] },
            { id: 'telebachillerato_37', name: 'Telebachillerato No. 37 (CSL)', type: 'public', technicalCareers: [] },
            { id: 'telebachillerato_38', name: 'Telebachillerato No. 38 (CSL)', type: 'public', technicalCareers: [] },
            { id: 'telebachillerato_39', name: 'Telebachillerato No. 39 (CSL)', type: 'public', technicalCareers: [] },
            { id: 'prepa_abierta', name: 'Preparatoria Abierta BCS', type: 'public', technicalCareers: [] },
            { id: 'inst_peninsular', name: 'Instituto Peninsular', type: 'private', technicalCareers: [] },
            { id: 'colegio_camino', name: 'Colegio El Camino', type: 'private', technicalCareers: [] },
            { id: 'otro', name: 'Otra preparatoria...', type: 'other', technicalCareers: [] }
        ],
        careersITES: {
            'ISC': { name: 'Ing. En Sistemas Computacionales', type: 'Ingeniería', icon: 'bi-laptop' },
            'ELEC': { name: 'Ing. Electromecánica', type: 'Ingeniería', icon: 'bi-lightning-charge' },
            'CIVIL': { name: 'Ing. Civil', type: 'Ingeniería', icon: 'bi-cone-striped' },
            'ARQ': { name: 'Arquitectura', type: 'Ingeniería/Diseño', icon: 'bi-rulers' },
            'ADM': { name: 'Ing. Administración', type: 'Ingeniería/Negocios', icon: 'bi-briefcase' },
            'CP': { name: 'Contador Público', type: 'Licenciatura', icon: 'bi-calculator' },
            'TUR': { name: 'Lic. En Turismo', type: 'Licenciatura', icon: 'bi-airplane' },
            'GASTRO': { name: 'Gastronomía', type: 'Licenciatura', icon: 'bi-cup-hot' }
        },
        technicalTransferMap: {
            'Refrigeración y Aire Acondicionado': 'ELEC',
            'Mecánica Naval': 'ELEC',
            'Mantenimiento Industrial': 'ELEC',
            'Electromecánica Industrial': 'ELEC',
            'Soporte y Mantenimiento de Equipo de Cómputo': 'ISC',
            'Técnico en Ofimática': 'ISC',
            'Ecoturismo': 'TUR',
            'Servicios de Hotelería': 'TUR',
            'Servicios de Hospedaje': 'TUR',
            'Hospitalidad Turística (Turismo)': 'TUR',
            'Preparación de Alimentos y Bebidas': 'GASTRO',
            'Alimentos y Bebidas': 'GASTRO',
            'Técnico en Logística': 'ADM',
            'Ventas': 'ADM',
            'Administración': 'ADM',
            'Técnico Agropecuario': 'CIVIL',
            'Pesca Deportiva y Buceo': 'TUR',
            'Recreaciones Acuáticas': 'TUR',
            'Acuacultura': 'GASTRO'
        }
    };

    let VOCACIONAL_TEST_DATA = [];

    async function initTestData() {
        if (VOCACIONAL_TEST_DATA.length > 0) return VOCACIONAL_TEST_DATA;
        try {
            const docRef = getDb().collection("vocacional_config").doc("test_data_v2");
            try {
                const docSnap = await docRef.get();
                if (docSnap.exists && docSnap.data().blocks) {
                    let blocksData = docSnap.data().blocks;
                    // If the user pasted JSON as a string field in Firebase instead of an Array
                    if (typeof blocksData === 'string') {
                        blocksData = JSON.parse(blocksData);
                    }
                    if (Array.isArray(blocksData) && blocksData.length > 0) {
                        VOCACIONAL_TEST_DATA = blocksData;
                        return VOCACIONAL_TEST_DATA;
                    }
                }
            } catch (fsErr) {
                console.warn("Firestore read failed, falling back to local JSON:", fsErr);
            }

            // Fallback locally
            const response = await fetch('./data/vocacional-preguntas-v2.json');
            const data = await response.json();
            VOCACIONAL_TEST_DATA = data;

            // Attempt to seed data silently without breaking if guest
            try {
                await docRef.set({ blocks: data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                console.log("Vocacional test data imported to Firestore");
            } catch (seedErr) {
                // Ignore silent seed error for guests
                console.log("Could not seed data to Firestore (probably guest permissions), continuing with local data.");
            }

        } catch (error) {
            console.error("Critical error in initTestData:", error);
        }
        return VOCACIONAL_TEST_DATA;
    }

    // ==========================================
    // METODOS DEL SERVICIO
    // ==========================================

    async function updateTestData(newData) {
        try {
            const docRef = getDb().collection("vocacional_config").doc("test_data_v2");
            if (!Array.isArray(newData)) {
                throw new Error("El formato del test debe ser un arreglo de bloques.");
            }
            await docRef.set({ blocks: newData, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            VOCACIONAL_TEST_DATA = newData;
            return true;
        } catch (error) {
            console.error("Error al actualizar test_data_v2:", error);
            throw error;
        }
    }

    async function findAspiranteByContact(phone, email) {
        try {
            // Utilizamos el teléfono como ID principal para evitar problemas de permisos
            // de 'list' en Firestore para usuarios no autenticados.
            if (phone) {
                const docRef = await getDb().collection(COLLECTION_NAME).doc(phone).get();
                if (docRef.exists) {
                    return docRef.id;
                }
            }
            return null;
        } catch (e) {
            console.error("Error finding aspirante:", e);
            return null;
        }
    }

    async function registerAspirante(personalInfo) {
        try {
            const existingId = await findAspiranteByContact(personalInfo.phone, personalInfo.email);
            if (existingId) return existingId; // Return existing ID to resume session

            const data = {
                personalInfo: {
                    name: personalInfo.name || '',
                    phone: personalInfo.phone || '',
                    email: personalInfo.email || '',
                    highSchool: personalInfo.highSchool || '',
                    technicalCareer: personalInfo.technicalCareer || null
                },
                testStatus: 'in_progress',
                currentBlock: 1,
                answers: {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Usamos el teléfono como ID del documento para que la recuperación por 'get' funcione sin permisos 'list'
            if (personalInfo.phone) {
                await getDb().collection(COLLECTION_NAME).doc(personalInfo.phone).set(data);
                return personalInfo.phone;
            } else {
                const docRef = await getDb().collection(COLLECTION_NAME).add(data);
                return docRef.id;
            }
        } catch (error) {
            console.error("Error registering aspirante:", error);
            throw error;
        }
    }

    async function saveTestProgress(aspiranteId, blockNumber, newAnswers) {
        try {
            const docRef = getDb().collection(COLLECTION_NAME).doc(aspiranteId);
            const docSnap = await docRef.get();
            if (!docSnap.exists) throw new Error("Aspirante no encontrado");

            const currentData = docSnap.data();
            const mergedAnswers = { ...currentData.answers, ...newAnswers };

            // Find if there's a next block
            let nextBlock = blockNumber + 1;
            if (nextBlock > VOCACIONAL_TEST_DATA.length) nextBlock = VOCACIONAL_TEST_DATA.length;

            await docRef.set({
                answers: mergedAnswers,
                currentBlock: nextBlock,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return true;
        } catch (error) {
            console.error("Error saving progress:", error);
            throw error;
        }
    }

    async function calculateAndFinish(aspiranteId) {
        try {
            const docRef = getDb().collection(COLLECTION_NAME).doc(aspiranteId);
            const docSnap = await docRef.get();
            if (!docSnap.exists) throw new Error("Aspirante no encontrado");

            const data = docSnap.data();
            const answers = data.answers || {};

            let scores = { ISC: 0, ELEC: 0, CIVIL: 0, ARQ: 0, ADM: 0, CP: 0, TUR: 0, GASTRO: 0 };
            let alerts = [];

            VOCACIONAL_TEST_DATA.forEach(block => {
                const blockWeight = block.weight || 1.0;

                let questionsToProcess = [];
                if (block.isAdaptive && block.groups && data.personalInfo?.technicalCareer) {
                    const tecCareer = data.personalInfo.technicalCareer;
                    const activeGroup = block.groups.find(g => g.conditions && g.conditions.includes(tecCareer));
                    if (activeGroup && activeGroup.questions) {
                        questionsToProcess = activeGroup.questions;
                    }
                } else if (block.questions) {
                    questionsToProcess = block.questions;
                }

                questionsToProcess.forEach(q => {
                    const answer = answers[q.id];
                    if (answer === undefined || answer === null) return;

                    if (q.type === 'likert') {
                        const val = parseInt(answer, 10);
                        if (val > 0 && q.targets) {
                            for (const [career, weight] of Object.entries(q.targets)) {
                                scores[career] = (scores[career] || 0) + (val * weight * blockWeight);
                            }
                        }
                        // Check alerts
                        if (q.alertRule && q.alertRule.alert) {
                            if (q.alertRule.condition === '<= 2' && val <= 2) {
                                alerts.push(q.alertRule.alert);
                            } else if (q.alertRule.condition === '>= 4' && val >= 4) {
                                alerts.push(q.alertRule.alert);
                            }
                        }
                    } else if (q.type === 'options') {
                        const optIndex = parseInt(answer, 10);
                        if (q.options && q.options[optIndex]) {
                            const selectedOption = q.options[optIndex];
                            if (selectedOption.targets) {
                                for (const [career, weight] of Object.entries(selectedOption.targets)) {
                                    // Multiple equivalent to likert 4 to balance with Likert answers
                                    scores[career] = (scores[career] || 0) + (4 * weight * blockWeight);
                                }
                            }
                            if (selectedOption.alert) {
                                alerts.push(selectedOption.alert);
                            }
                        }
                    }
                });
            });

            // Extra points for direct match career
            const tecCareer = data.personalInfo?.technicalCareer;
            let directMatchCareer = null;
            if (tecCareer && VOCACIONAL_CATALOGS.technicalTransferMap[tecCareer]) {
                directMatchCareer = VOCACIONAL_CATALOGS.technicalTransferMap[tecCareer];
                scores[directMatchCareer] += 15;
            }

            const sortedCareers = Object.keys(scores).map(key => ({
                id: key,
                name: VOCACIONAL_CATALOGS.careersITES[key].name,
                type: VOCACIONAL_CATALOGS.careersITES[key].type,
                icon: VOCACIONAL_CATALOGS.careersITES[key].icon,
                score: scores[key],
                isDirectMatch: (key === directMatchCareer)
            })).sort((a, b) => b.score - a.score);

            const top3 = sortedCareers.slice(0, 3);
            const maxScore = top3[0].score > 0 ? top3[0].score : 1;
            top3.forEach(c => { c.percentage = Math.round((c.score / maxScore) * 100); });

            const finishPayload = {
                testStatus: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                testResults: scores,
                recommendedCareers: top3,
                psychopedagogicalAlerts: alerts
            };

            await docRef.set(finishPayload, { merge: true });

            return { ...data, ...finishPayload };

        } catch (error) {
            console.error("Error calculando resultados:", error);
            throw error;
        }
    }

    async function getAspiranteResults(aspiranteId) {
        const docSnap = await getDb().collection(COLLECTION_NAME).doc(aspiranteId).get();
        return docSnap.exists ? docSnap.data() : null;
    }

    async function getAspirantes(limitCount = 50, lastDoc = null) {
        let query = getDb().collection(COLLECTION_NAME)
            .orderBy("createdAt", "desc")
            .limit(limitCount);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const querySnapshot = await query.get();
        return {
            docs: querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1] || null
        };
    }

    async function getCRMStats() {
        const CACHE_DOC = 'vocacional_stats';
        const cacheRef = getDb().collection('reportes_cache').doc(CACHE_DOC);

        try {
            // 1. Intentar leer desde caché
            const docSnap = await cacheRef.get();
            const now = Date.now();
            let needsRefresh = true;

            if (docSnap.exists) {
                const data = docSnap.data();
                const lastUpdated = data.lastUpdated ? data.lastUpdated.toMillis() : 0;
                // Si la caché tiene menos de 1 hora de antigüedad, la usamos
                if (now - lastUpdated < 3600000) {
                    needsRefresh = false;
                    return data.stats;
                }
            }

            // 2. Si necesita refresh (no existe o expiró), calculamos desde la base de datos
            console.log("Generando nueva caché de Estadísticas del CRM Vocacional...");
            const snapshot = await getDb().collection(COLLECTION_NAME).get();
            const total = snapshot.docs.length;
            let completed = 0;
            let careersCount = {};
            let prepasCount = {};

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.testStatus === 'completed') {
                    completed++;
                    if (data.recommendedCareers && data.recommendedCareers.length > 0) {
                        const top1 = data.recommendedCareers[0].name;
                        careersCount[top1] = (careersCount[top1] || 0) + 1;
                    }
                }
                if (data.personalInfo && data.personalInfo.highSchool) {
                    const prepa = data.personalInfo.highSchool;
                    prepasCount[prepa] = (prepasCount[prepa] || 0) + 1;
                }
            });

            const ofertaObj = Object.values(VOCACIONAL_CATALOGS.careersITES).map(c => ({ id: c.name, name: c.name }));

            const stats = {
                totalAspirantes: total,
                totalCompleted: completed,
                demandaCareers: careersCount,
                procedenciaPrepas: prepasCount,
                ofertaEducativa: ofertaObj
            };

            // 3. Guardar en caché
            try {
                await cacheRef.set({
                    stats: stats,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                console.warn("No se pudo guardar la caché de vocacional (quizás reglas de seguridad), devolviendo datos en vivo:", err);
            }

            return stats;

        } catch (error) {
            console.error("Error al obtener estadísticas del CRM:", error);
            throw error;
        }
    }

    function getCatalog() {
        return {
            preparatorias: VOCACIONAL_CATALOGS.highSchools.map(h => h.name),
            ofertaEducativa: Object.keys(VOCACIONAL_CATALOGS.careersITES).map(k => ({
                id: VOCACIONAL_CATALOGS.careersITES[k].name,
                name: VOCACIONAL_CATALOGS.careersITES[k].name
            })),
            mapeo: VOCACIONAL_CATALOGS,
            preguntas: VOCACIONAL_TEST_DATA
        };
    }

    // Public API
    return {
        initTestData,
        updateTestData,
        registerAspirante,
        findAspiranteByContact,
        saveTestProgress,
        calculateAndFinish,
        getAspiranteResults,
        getAspirantes,
        getCRMStats,
        getCatalog,
        // Expose variables for UI
        VOCACIONAL_CATALOGS,
        get VOCACIONAL_TEST_DATA() { return VOCACIONAL_TEST_DATA; }
    };

})();

window.VocacionalService = VocacionalService;
