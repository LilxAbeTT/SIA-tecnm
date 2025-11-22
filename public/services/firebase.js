// services/firebase.js
// Init + helpers de perfil

(function(global){
  const firebaseConfig = {
    apiKey: "AIzaSyDa0T8ptJzEHzcKSkhNEBfRbyW2y4prnU8",
    authDomain: "sia-tecnm.firebaseapp.com",
    projectId: "sia-tecnm",
    storageBucket: "sia-tecnm.appspot.com",
    messagingSenderId: "435425224959",
    appId: "1:435425224959:web:4362523f6ef509a86684ca"
  };

  // 1. Inicializar
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  const auth = firebase.auth();
  const db = firebase.firestore();

  // 2. FORZAR PERSISTENCIA LOCAL (CRÍTICO PARA REDIRECT)
  // Esto obliga al navegador a guardar la sesión antes de recargar la página
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log("💾 [Firebase] Persistencia establecida: LOCAL"))
    .catch((error) => console.error("❌ [Firebase] Error persistencia:", error));

  async function ensureProfile(user){
    const ref = db.collection('usuarios').doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists){
      const profile = {
        email: user.email,
        role: 'student',
        especialidad: null,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await ref.set(profile);
      return profile;
    }
    return snap.data();
  }

  global.SIA = { 
    auth, 
    db, 
    ensureProfile,
    FieldValue: firebase.firestore.FieldValue,
    FieldPath: firebase.firestore.FieldPath
  };
})(window);