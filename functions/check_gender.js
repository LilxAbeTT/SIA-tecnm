const admin = require('firebase-admin');

// Ensure we don't initialize twice if running in an existing context, 
// but since it's a standalone script, we can just initialize.
admin.initializeApp({
  projectId: "sia-tecnm"
});

const db = admin.firestore();

async function findUsersWithoutGender() {
  try {
    const snapshot = await db.collection('usuarios').get();
    
    let noGenderCount = 0;
    const discrepancies = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const genero = (data.genero || data.gender || data.sexo || (data.personalData && data.personalData.genero) || '').trim();
      
      if (!genero) {
        noGenderCount++;
        // Save first 10 for sample
        if (discrepancies.length < 10) {
          discrepancies.push({
            uid: doc.id,
            nombre: data.nombre || data.displayName || 'Desconocido',
            matricula: data.matricula || 'N/A',
            tipoUsuario: data.tipoUsuario || 'N/A'
          });
        }
      }
    });

    console.log(`Total de usuarios escaneados: ${snapshot.size}`);
    console.log(`Total sin género definido: ${noGenderCount}`);
    
    if (noGenderCount > 0) {
      console.log("\nEjemplo de 10 usuarios sin género:");
      console.table(discrepancies);
    }
  } catch (err) {
    console.error("Error al buscar usuarios:", err);
  }
}

findUsersWithoutGender();
