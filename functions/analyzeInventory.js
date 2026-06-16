const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'sia-tecnm' });
const db = admin.firestore();

async function run() {
    try {
        console.log("Fetching documents...");
        // let's fetch all
        const snapshot = await db.collection('biblio-catalogo').get();
        console.log(`Total documents: ${snapshot.size}`);

        const boundaryStart = new Date('2026-06-03T00:00:00-07:00');
        
        let oldDocs = [];
        let newDocs = [];
        let mergedDocs = [];
        let updatedSinceJune3 = [];

        const groupByKey = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : null;
            const updatedAt = data.updatedAt ? data.updatedAt.toDate() : null;
            
            const docInfo = {
                id: doc.id,
                adquisicion: data.adquisicion,
                titulo: data.titulo,
                autor: data.autor,
                createdAt,
                updatedAt,
                isMerged: data.isMerged || false,
                active: data.active
            };

            if (createdAt && createdAt >= boundaryStart) {
                newDocs.push(docInfo);
            } else {
                oldDocs.push(docInfo);
            }
            
            if (updatedAt && updatedAt >= boundaryStart) {
                updatedSinceJune3.push(docInfo);
            }

            if (data.isMerged) {
                mergedDocs.push(docInfo);
            }

            const key = data.inventoryGroupKey || data.tituloSearch || data.titulo;
            if (key) {
                if (!groupByKey[key]) groupByKey[key] = [];
                groupByKey[key].push(docInfo);
            }
        });

        console.log(`Old docs: ${oldDocs.length}`);
        console.log(`New docs (created since June 3): ${newDocs.length}`);
        console.log(`Docs updated since June 3: ${updatedSinceJune3.length}`);
        console.log(`Merged docs: ${mergedDocs.length}`);

        let exactDuplicatesOldVsNew = 0;
        let totalDuplicates = 0;
        let newDocsThatAreDuplicates = 0;

        for (const key in groupByKey) {
            if (groupByKey[key].length > 1) {
                totalDuplicates++;
                const docs = groupByKey[key];
                const hasOld = docs.some(d => d.createdAt && d.createdAt < boundaryStart);
                const hasNew = docs.some(d => d.createdAt && d.createdAt >= boundaryStart);
                
                if (hasOld && hasNew) {
                    exactDuplicatesOldVsNew++;
                }

                const newInGroup = docs.filter(d => d.createdAt && d.createdAt >= boundaryStart);
                newDocsThatAreDuplicates += newInGroup.length;
            }
        }

        console.log(`Found ${totalDuplicates} duplicate groups`);
        console.log(`Of those, ${exactDuplicatesOldVsNew} groups have BOTH pre-June 3 and post-June 3 documents.`);
        console.log(`Number of new docs that duplicate an existing doc: ${newDocsThatAreDuplicates}`);

    } catch (e) {
        console.error(e);
    }
}

run();
