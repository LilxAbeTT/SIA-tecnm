export class UiManager {
    constructor() {
        this.landingView = document.querySelector('sia-landing-view') || document.getElementById('landing-view');
        this.appShell = document.getElementById('app-shell');
        this.appLoader = document.getElementById('app-loader');
        this.registerWizard = document.querySelector('sia-register-wizard');
        this.verifyShell = document.getElementById('verify-shell');
        this.fabAddCourse = document.getElementById('aula-add-course-fab');
    }

    showLoader() {
        if (this.appLoader) {
            this.appLoader.classList.remove('d-none');
            this.appLoader.style.opacity = '1';
        }
    }

    hideLoader() {
        if (this.appLoader) {
            this.appLoader.style.opacity = '0';
            setTimeout(() => {
                this.appLoader.classList.add('d-none');
            }, 500);
        }
    }

    showLanding() {
        if (this.landingView) this.landingView.classList.remove('d-none');

        // Force Hide AppShell
        if (this.appShell) {
            this.appShell.classList.add('d-none');
            this.appShell.style.display = 'none';
        }

        if (this.registerWizard) {
            this.registerWizard.classList.add('d-none');
            this.registerWizard.style.display = 'none';
        }
        if (this.verifyShell) this.verifyShell.classList.add('d-none');
        if (this.fabAddCourse) this.fabAddCourse.classList.add('d-none');

        // Clear specific view containers to be safe (Optional, but good practice)
        // const viewsToClear = ['view-biblio', 'view-medi', 'view-aula', 'view-foro', 'view-dashboard', 'view-profile'];
        // viewsToClear.forEach(id => {
        //    const el = document.getElementById(id);
        //    // if (el) el.innerHTML = ''; // CAREFUL: Only if re-rendering logic exists!
        // });
    }

    showApp() {
        if (this.landingView) this.landingView.classList.add('d-none');
        if (this.registerWizard) this.registerWizard.classList.add('d-none');

        if (this.appShell) {
            this.appShell.classList.remove('d-none');
            this.appShell.style.display = ''; // Reset display
        }

        if (this.verifyShell) this.verifyShell.classList.add('d-none');
    }

    showRegisterWizard() {
        if (this.landingView) this.landingView.classList.add('d-none');
        if (this.appShell) {
            this.appShell.classList.add('d-none');
            this.appShell.style.display = 'none';
        }
        if (this.registerWizard) {
            this.registerWizard.classList.remove('d-none');
            this.registerWizard.style.display = '';
        }
    }
}
