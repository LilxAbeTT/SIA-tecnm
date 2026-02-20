import { Store } from './state.js';

export class AuthManager {
    constructor(router, ui) {
        this.router = router;
        this.ui = ui;
        this.auth = null; // Firebase Auth instance
        this.db = null;   // Firestore instance
    }

    init(firebaseAuth, firestoreDb) {
        this.auth = firebaseAuth;
        this.db = firestoreDb;

        this.auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.ui.showLoader();

                try {
                    // ⚡ DEV MODE SIMULATION (SIA-Core Support) ⚡
                    let profile = null;
                    const isDevMode = localStorage.getItem('sia_dev_mode') === 'true';
                    const simProfileJson = localStorage.getItem('sia_simulated_profile');

                    if (isDevMode && simProfileJson) {
                        try {
                            const sim = JSON.parse(simProfileJson);
                            // Merge with real UID to bind Firebase User
                            profile = { ...sim, uid: user.uid, email: user.email };
                            console.log("[AuthManager] ⚡ Dev Mode Profile Loaded:", profile.role);
                        } catch (e) {
                            console.error("Sim parse error", e);
                        }
                    }

                    // Fetch Real Profile only if no simulation
                    if (!profile) {
                        profile = await this._fetchProfile(user.uid);
                    }

                    Store.setUser(user, profile);

                    // Decide where to go
                    this.router.handleLocation(); // Or logic to redirect if at landing

                } catch (e) {
                    console.error("Error fetching profile:", e);
                    // Handle error (maybe logout if profile invalid)
                } finally {
                    this.ui.hideLoader();
                }
            } else {
                Store.clear();
                this.ui.showLanding();
                this.ui.hideLoader();
            }
        });
    }

    async _fetchProfile(uid) {
        // Basic fetch logic matching current app.js
        // We assume 'usuarios' collection
        // ... (Implementation detail to be filled with real Firestore call)
        // For now returning mock or minimal
        if (!this.db) return { role: 'student' };

        try {
            const doc = await this.db.collection('usuarios').doc(uid).get();
            if (doc.exists) return doc.data();
            return { role: 'student' }; // Default
        } catch (e) {
            console.error("Profile fetch error", e);
            throw e;
        }
    }

    async loginWithMicrosoft() {
        // Call Firebase signInWithPopup...
        // This logic is currently in app.js, we will move it here.
        if (!this.auth) return;
        const provider = new firebase.auth.OAuthProvider('microsoft.com');
        provider.setCustomParameters({
            prompt: 'select_account',
            tenant: 'common' // or specific tenant
        });

        try {
            await this.auth.signInWithPopup(provider);
        } catch (e) {
            console.error("Login failed", e);
            throw e;
        }
    }

    async logout() {
        this.ui.showLoader();
        try {
            await this.auth.signOut();
        } catch (e) {
            console.warn("SignOut error", e);
        }

        Store.clear();

        // Modules cleanup
        window.ModuleManager && window.ModuleManager.clearAll(); // Legacy support

        // Hardware Reload as strictly requested
        window.location.href = '/';
    }
}
